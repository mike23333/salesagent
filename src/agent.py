"""Rozetka AI Sales Agent - Autonomous outbound sales with upsells and human handoff."""

import logging
import os

import httpx
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    room_io,
)
from livekit.plugins import google, noise_cancellation, silero

from services.firebase_service import FirebaseService

logger = logging.getLogger("rozetka_agent")

load_dotenv(".env.local")

# Telegram webhook URL for sending links
TELEGRAM_WEBHOOK_URL = os.getenv("TELEGRAM_WEBHOOK_URL", "http://localhost:8000/send-link")


SALES_PROMPT = """You are a friendly and professional sales agent for Rozetka, Ukraine's largest e-commerce platform.
You are calling customers who have recently placed an order to confirm their purchase and offer relevant upsells.

Your communication style:
- Speak naturally and conversationally in Ukrainian or Russian based on customer preference
- Be warm, helpful, and not pushy
- Keep responses concise since this is a voice call
- If the customer seems uninterested, gracefully accept and thank them

Your call flow:
1. Greet the customer by name and introduce yourself from Rozetka
2. Confirm their recent order (product name and price)
3. Ask if they have any questions about their order
4. Offer the relevant upsell product naturally - explain its benefits briefly
5. If they're interested, use the send_link tool to send them the product link via Telegram
6. If they want to speak with a human or have complex issues, use the transfer_to_human tool

Important rules:
- Never invent order details - use only the context provided
- If the customer asks to speak to a manager or human, immediately use transfer_to_human
- If you send a link, confirm you've sent it and ask if they received it
- Always end calls politely, thanking them for choosing Rozetka

Current order context will be provided when the call starts.
"""


class RozetkaSalesAgent(Agent):
    """Sales agent for Rozetka e-commerce platform."""

    def __init__(
        self,
        order_context: dict | None = None,
        call_id: str | None = None,
        firebase: FirebaseService | None = None,
        room: rtc.Room | None = None,
    ) -> None:
        self.order_context = order_context or {}
        self.call_id = call_id
        self.firebase = firebase
        self.room = room
        self._handoff_pending = False  # Track if waiting for human operator

        # Build dynamic instructions with order context
        instructions = SALES_PROMPT
        if order_context:
            instructions += f"""

Current call context:
- Customer Name: {order_context.get('customer_name', 'Customer')}
- Order: {order_context.get('product_name', 'Unknown product')}
- Order Price: {order_context.get('product_price', 0)} UAH
- Upsell Product: {order_context.get('upsell_product', 'Premium Warranty')}
- Upsell Price: {order_context.get('upsell_price', 0)} UAH
"""

        super().__init__(instructions=instructions)

    @function_tool()
    async def send_link(
        self,
        context: RunContext,
        platform: str,
        link: str,
    ) -> str:
        """Send a product link to the customer via messaging platform.

        Use this when the customer expresses interest in a product and wants
        to receive a link to view or purchase it.

        Args:
            platform: The messaging platform to use (telegram or viber)
            link: The full URL to the product page
        """
        logger.info(f"Sending link via {platform}: {link}")

        # Get phone number from participant identity
        phone = self.order_context.get("phone", "unknown")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    TELEGRAM_WEBHOOK_URL,
                    json={
                        "platform": platform,
                        "phone": phone,
                        "link": link,
                        "customer_name": self.order_context.get("customer_name", ""),
                        "product_name": self.order_context.get("upsell_product", ""),
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                logger.info(f"Link sent successfully: {response.status_code}")
                return f"Link successfully sent via {platform}. Ask if they received it."
        except httpx.HTTPError as e:
            logger.error(f"Failed to send link: {e}")
            return f"Sorry, I couldn't send the link via {platform} right now. Please try again later or I can give you the link verbally."
        except Exception as e:
            logger.error(f"Unexpected error sending link: {e}")
            return "There was an issue sending the link. Would you like me to read it to you instead?"

    @function_tool()
    async def transfer_to_human(
        self,
        context: RunContext,
        reason: str = "",
    ) -> str:
        """Transfer the call to a human sales representative.

        Use this when:
        - The customer explicitly asks to speak with a human or manager
        - The customer has a complex issue you cannot resolve
        - The customer is upset or frustrated
        - You need human judgment for a special request

        Args:
            reason: Brief description of why the transfer is needed
        """
        logger.info(f"Handoff requested: {reason}")
        self._handoff_pending = True

        # Update Firebase to mark handoff
        if self.firebase and self.call_id:
            try:
                await self.firebase.request_handoff(self.call_id, reason)
            except Exception as e:
                logger.error(f"Failed to update handoff status: {e}")

        # Extract conversation history for the human operator
        transcript = []
        try:
            # Get history from the session (complete conversation history)
            history = context.session.history
            if history:
                for item in history.items:
                    if item.type == "message" and item.text_content:
                        speaker = 'user' if item.role == 'user' else 'agent'
                        transcript.append({
                            'speaker': speaker,
                            'text': item.text_content[:500],  # Limit length
                            'timestamp': '',
                        })
        except Exception as e:
            logger.warning(f"Could not extract transcript: {e}")

        # Register handoff with UI dashboard (so human can take over)
        try:
            room_name = self.room.name if self.room else "unknown"
            async with httpx.AsyncClient() as client:
                await client.post(
                    "http://localhost:3000/api/handoffs/register",
                    json={
                        "call_id": self.call_id,
                        "room_name": room_name,
                        "phone_number": self.order_context.get("phone", "Unknown"),
                        "customer_name": self.order_context.get("customer_name", "Customer"),
                        "product_name": self.order_context.get("product_name", "Unknown"),
                        "reason": reason,
                        "transcript": transcript,
                    },
                    timeout=5.0,
                )
                logger.info(f"Handoff registered with dashboard for room: {room_name}")
        except Exception as e:
            logger.warning(f"Could not register handoff with dashboard: {e}")

        # Send data packet to notify dashboard (frontend will receive this)
        try:
            if self.room:
                await self.room.local_participant.publish_data(
                    payload=f'{{"type":"handoff","call_id":"{self.call_id}","reason":"{reason}"}}'.encode(),
                    reliable=True,
                )
        except Exception as e:
            logger.warning(f"Could not send handoff notification: {e}")

        # Put customer on hold - disable AI audio output after this message
        # The agent will say the transfer message, then go silent
        # Audio will be re-enabled when human operator joins
        logger.info("Customer will be placed on hold after transfer message")

        return "I'm connecting you with one of our team members now. Please hold for just a moment while I transfer you. They will have all the context from our conversation."


server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    """Prewarm models for faster startup."""
    proc.userdata["vad"] = silero.VAD.load()
    proc.userdata["firebase"] = FirebaseService()


server.setup_fnc = prewarm


@server.rtc_session()
async def sales_agent(ctx: JobContext) -> None:
    """Main entry point for the sales agent."""
    # Logging setup
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    firebase: FirebaseService = ctx.proc.userdata["firebase"]

    # Extract phone number from first participant (for SIP calls, this is the caller)
    phone_number = "unknown"
    for participant in ctx.room.remote_participants.values():
        phone_number = participant.identity
        break

    # Load order context for this customer
    order_context = await firebase.get_order_context(phone_number)
    order_context["phone"] = phone_number

    # Log call start
    call_id = await firebase.log_call_start(
        room_name=ctx.room.name,
        phone_number=phone_number,
        order_context=order_context,
    )

    logger.info(f"Starting sales call for {phone_number}, order: {order_context.get('product_name')}")

    # Create the sales agent with context
    agent = RozetkaSalesAgent(
        order_context=order_context,
        call_id=call_id,
        firebase=firebase,
        room=ctx.room,
    )

    # Set up the voice session with Gemini Live API
    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            voice="Puck",
            model="gemini-2.5-flash-native-audio-preview-12-2025",
            temperature=0.8,
        ),
        vad=ctx.proc.userdata["vad"],
    )

    # Start the session
    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony()
                if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                else noise_cancellation.BVC(),
            ),
        ),
    )

    # Connect to the room
    await ctx.connect()

    # Handle human operator joining for warm transfer
    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        """Detect when human operator joins and disable AI."""
        if participant.identity.startswith("human_operator"):
            logger.info(f"Human operator joined: {participant.identity}")

            # Check if handoff was requested
            if agent._handoff_pending:
                logger.info("Handoff pending - disabling AI audio I/O for warm transfer")

                # Disable AI audio input/output to let human take over
                # This puts the AI "on mute" while human handles the call
                try:
                    session.input.set_audio_enabled(False)
                    session.output.set_audio_enabled(False)
                    logger.info("AI audio disabled - human operator now handling call")
                except Exception as e:
                    logger.error(f"Error disabling AI audio: {e}")

                # Update call status
                import asyncio
                task = asyncio.create_task(
                    firebase.update_call_status(call_id, "human_handling")
                )
                ctx.proc.userdata.setdefault("cleanup_tasks", []).append(task)
            else:
                logger.info("Human operator joined but no handoff was requested")

    # Update call status when done
    @ctx.room.on("disconnected")
    def on_disconnect() -> None:
        import asyncio
        task = asyncio.create_task(
            firebase.update_call_status(call_id, "completed")
        )
        # Store reference to prevent garbage collection
        ctx.proc.userdata.setdefault("cleanup_tasks", []).append(task)


if __name__ == "__main__":
    cli.run_app(server)
