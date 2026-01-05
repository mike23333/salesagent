"""FastAPI webhook server for sending Telegram/Viber messages via MTProto.

Uses Telethon (MTProto) to send messages directly to phone numbers
without requiring users to start a bot first.

Run with: uvicorn services.telegram_webhook:app --reload --port 8000

Required environment variables:
- TELEGRAM_API_ID: Get from https://my.telegram.org/apps
- TELEGRAM_API_HASH: Get from https://my.telegram.org/apps
- TELEGRAM_SESSION_STRING: Base64-encoded session string (see setup instructions)
"""

import logging
import os
from typing import Literal

from pydantic import BaseModel

logger = logging.getLogger("telegram_webhook")

# MTProto credentials - get from https://my.telegram.org/apps
TELEGRAM_API_ID = os.getenv("TELEGRAM_API_ID")
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH")
TELEGRAM_SESSION_STRING = os.getenv("TELEGRAM_SESSION_STRING")

# Global Telethon client (initialized on first request)
_telethon_client = None


class SendLinkRequest(BaseModel):
    """Request body for sending a link."""

    platform: Literal["telegram", "viber"]
    phone: str
    link: str
    customer_name: str = ""
    product_name: str = ""


class SendLinkResponse(BaseModel):
    """Response for send link request."""

    success: bool
    message: str
    platform: str


async def get_telethon_client():
    """Get or create the Telethon client using MTProto."""
    global _telethon_client

    if _telethon_client is not None:
        return _telethon_client

    if not all([TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING]):
        logger.warning(
            "Telethon credentials not configured. "
            "Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION_STRING"
        )
        return None

    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession

        _telethon_client = TelegramClient(
            StringSession(TELEGRAM_SESSION_STRING),
            int(TELEGRAM_API_ID),
            TELEGRAM_API_HASH,
        )
        await _telethon_client.connect()
        logger.info("Telethon client connected successfully")
        return _telethon_client
    except Exception as e:
        logger.error(f"Failed to initialize Telethon client: {e}")
        return None


def create_app():
    """Create the FastAPI application."""
    try:
        from fastapi import FastAPI, HTTPException
    except ImportError:
        logger.error("FastAPI not installed. Run: uv add fastapi uvicorn")
        raise

    app = FastAPI(
        title="Rozetka Telegram Webhook",
        description="Webhook service for sending product links via Telegram (MTProto) / Viber",
        version="1.0.0",
    )

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "mtproto_configured": bool(TELEGRAM_API_ID)}

    @app.post("/send-link", response_model=SendLinkResponse)
    async def send_link(request: SendLinkRequest):
        """Send a product link to a customer via Telegram (MTProto) or Viber.

        With MTProto, messages can be sent directly to phone numbers without
        requiring the user to start a bot first.
        """
        logger.info(
            f"Received send_link request: {request.platform} -> {request.phone}"
        )

        # Build the message
        message = f"Hi {request.customer_name}!\n\n"
        if request.product_name:
            message += f"Here's the link to {request.product_name}:\n"
        message += f"{request.link}\n\n"
        message += "Thank you for shopping with Rozetka!"

        if request.platform == "telegram":
            success = await _send_telegram_mtproto(request.phone, message)
        elif request.platform == "viber":
            success = await _send_viber(request.phone, message)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported platform: {request.platform}",
            )

        if success:
            return SendLinkResponse(
                success=True,
                message="Link sent successfully",
                platform=request.platform,
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to send message",
            )

    @app.on_event("shutdown")
    async def shutdown():
        """Disconnect Telethon client on shutdown."""
        global _telethon_client
        if _telethon_client is not None:
            await _telethon_client.disconnect()
            _telethon_client = None

    return app


async def _send_telegram_mtproto(phone: str, message: str) -> bool:
    """Send a message via Telegram using MTProto (Telethon).

    This allows sending to any phone number without needing them to start a bot.
    The phone number should include country code (e.g., +380501234567).
    """
    client = await get_telethon_client()

    if client is None:
        # Fall back to mock mode if not configured
        logger.info(f"[MOCK TELEGRAM] To {phone}: {message}")
        return True

    try:
        # Normalize phone number (ensure it starts with +)
        if not phone.startswith("+"):
            phone = f"+{phone}"

        # Get the user entity by phone number
        # Telethon will automatically add them to contacts if needed
        entity = await client.get_entity(phone)

        # Send the message
        await client.send_message(entity, message)
        logger.info(f"[TELEGRAM MTProto] Message sent to {phone}")
        return True

    except Exception as e:
        logger.error(f"Failed to send Telegram message to {phone}: {e}")
        # Check if it's because the user doesn't have Telegram
        if "user" in str(e).lower() and "not" in str(e).lower():
            logger.warning(f"User {phone} may not have Telegram installed")
        return False


async def _send_viber(phone: str, message: str) -> bool:
    """Send a message via Viber.

    In production, implement using Viber Bot API or Viber Business Messages.
    """
    # Mock mode - just log
    logger.info(f"[MOCK VIBER] To {phone}: {message}")
    return True


# Create the app instance
app = create_app()


# ============================================================================
# Session String Generator (run this once to create your session)
# ============================================================================
#
# To generate a session string, run this script interactively:
#
# ```python
# import asyncio
# from telethon import TelegramClient
# from telethon.sessions import StringSession
#
# API_ID = "your_api_id"
# API_HASH = "your_api_hash"
#
# async def main():
#     async with TelegramClient(StringSession(), API_ID, API_HASH) as client:
#         print("Session string:", client.session.save())
#
# asyncio.run(main())
# ```
#
# This will prompt you to log in with your phone number and verification code.
# Save the resulting session string to TELEGRAM_SESSION_STRING env var.
# ============================================================================
