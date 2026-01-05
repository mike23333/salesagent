"""Tests for the Rozetka Sales Agent."""

import pytest
from livekit.agents import AgentSession
from livekit.plugins import google

from agent import RozetkaSalesAgent


def _llm() -> google.LLM:
    """Create LLM for testing."""
    return google.LLM(model="gemini-2.5-flash")


@pytest.fixture
def order_context() -> dict:
    """Sample order context for testing."""
    return {
        "order_id": "test-123",
        "customer_name": "John",
        "product_name": "iPhone 15",
        "product_price": 45999,
        "upsell_product": "AppleCare+ Protection",
        "upsell_price": 4999,
        "phone": "+380501234567",
    }


@pytest.mark.asyncio
async def test_greets_customer_by_name(order_context: dict) -> None:
    """Test that the agent greets the customer by name."""
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        agent = RozetkaSalesAgent(order_context=order_context)
        await session.start(agent)

        result = await session.run(user_input="Hello")

        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm,
                intent="""
                Greets the user in a friendly manner and identifies as being from Rozetka.
                May mention the customer's name (John) or their recent order.
                Should be professional and warm.
                """,
            )
        )

        result.expect.no_more_events()


@pytest.mark.asyncio
async def test_offers_upsell_naturally(order_context: dict) -> None:
    """Test that the agent can offer an upsell product."""
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        agent = RozetkaSalesAgent(order_context=order_context)
        await session.start(agent)

        result = await session.run(
            user_input="Yes, I just ordered an iPhone. Everything is fine with my order."
        )

        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm,
                intent="""
                Acknowledges the order confirmation and naturally transitions to
                mentioning the upsell product (AppleCare+ Protection or similar protection plan).
                Should not be pushy or aggressive - just a natural mention of the benefit.
                """,
            )
        )

        result.expect.no_more_events()


@pytest.mark.asyncio
async def test_respects_customer_decline() -> None:
    """Test that the agent gracefully handles customer declining the upsell."""
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        agent = RozetkaSalesAgent(
            order_context={
                "customer_name": "Maria",
                "product_name": "Laptop",
                "product_price": 30000,
                "upsell_product": "Extended Warranty",
                "upsell_price": 2000,
            }
        )
        await session.start(agent)

        result = await session.run(
            user_input="No thanks, I'm not interested in any additional products."
        )

        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm,
                intent="""
                Gracefully accepts the customer's decision without being pushy.
                Thanks them for their order and/or wishes them well.
                Does NOT continue to push the upsell product.
                """,
            )
        )

        result.expect.no_more_events()


@pytest.mark.asyncio
async def test_transfer_to_human_request() -> None:
    """Test that the agent recognizes request to speak with a human."""
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        agent = RozetkaSalesAgent(
            order_context={
                "customer_name": "Alex",
                "product_name": "TV",
                "product_price": 20000,
            }
        )
        await session.start(agent)

        result = await session.run(
            user_input="I want to speak with a real person, not an AI."
        )

        # Should either call the transfer_to_human tool or acknowledge the request
        event = await result.expect.next_event()

        # Check if it's a tool call or a message acknowledging the transfer
        if event.type == "function_call":
            assert event.function_name == "transfer_to_human"
        else:
            await (
                event.is_message(role="assistant")
                .judge(
                    llm,
                    intent="""
                    Acknowledges the request to speak with a human representative.
                    Indicates they will transfer the call or connect them with someone.
                    """,
                )
            )


@pytest.mark.asyncio
async def test_send_link_on_interest() -> None:
    """Test that the agent offers to send a link when customer shows interest."""
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        agent = RozetkaSalesAgent(
            order_context={
                "customer_name": "Sofia",
                "product_name": "Headphones",
                "product_price": 5000,
                "upsell_product": "Premium Carrying Case",
                "upsell_price": 500,
                "phone": "+380671234567",
            }
        )
        await session.start(agent)

        result = await session.run(
            user_input="That case sounds interesting, can you send me more info about it?"
        )

        # Should either call send_link tool or offer to send the link
        event = await result.expect.next_event()

        if event.type == "function_call":
            assert event.function_name == "send_link"
        else:
            await (
                event.is_message(role="assistant")
                .judge(
                    llm,
                    intent="""
                    Offers to send more information about the product.
                    May ask which platform (Telegram/Viber) to send it to,
                    or indicate they will send a link.
                    """,
                )
            )
