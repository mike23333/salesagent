"""Firebase Firestore service for call logs, transcripts, and order data."""

import logging
import os
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("firebase_service")

# Firebase initialization is optional - will use mock data if not configured
_db = None
_initialized = False


def _init_firebase() -> bool:
    """Initialize Firebase Admin SDK if credentials are available."""
    global _db, _initialized

    if _initialized:
        return _db is not None

    _initialized = True

    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path or not os.path.exists(creds_path):
        logger.warning("Firebase credentials not found. Using mock data mode.")
        return False

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        cred = credentials.Certificate(creds_path)
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
        logger.info("Firebase initialized successfully")
        return True
    except Exception as e:
        logger.warning(f"Failed to initialize Firebase: {e}. Using mock data mode.")
        return False


class FirebaseService:
    """Service for interacting with Firebase Firestore."""

    def __init__(self) -> None:
        self._use_firebase = _init_firebase()

    async def get_order_context(self, phone_number: str) -> dict[str, Any]:
        """Fetch order details for a customer by phone number.

        Args:
            phone_number: Customer's phone number (participant identity)

        Returns:
            Order context with product info, customer name, etc.
        """
        if self._use_firebase and _db:
            try:
                orders_ref = _db.collection("orders")
                query = orders_ref.where("phone", "==", phone_number).limit(1)
                docs = query.stream()

                for doc in docs:
                    data = doc.to_dict()
                    return {
                        "order_id": doc.id,
                        "customer_name": data.get("customer_name", "Customer"),
                        "product_name": data.get("product_name", "your order"),
                        "product_price": data.get("price", 0),
                        "upsell_product": data.get("upsell_product", "a premium warranty"),
                        "upsell_price": data.get("upsell_price", 199),
                    }
            except Exception as e:
                logger.error(f"Error fetching order: {e}")

        # Mock data for testing
        return {
            "order_id": "mock-123",
            "customer_name": "Valued Customer",
            "product_name": "Samsung Galaxy S24",
            "product_price": 25999,
            "upsell_product": "Premium Protection Plan",
            "upsell_price": 1499,
        }

    async def log_call_start(
        self,
        room_name: str,
        phone_number: str,
        order_context: dict[str, Any],
    ) -> str:
        """Log the start of a call to Firestore.

        Returns:
            The call document ID
        """
        call_data = {
            "room_name": room_name,
            "phone": phone_number,
            "order_id": order_context.get("order_id"),
            "customer_name": order_context.get("customer_name"),
            "status": "in_progress",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "transcript": [],
            "upsell_offered": False,
            "upsell_accepted": False,
            "handoff_requested": False,
        }

        if self._use_firebase and _db:
            try:
                doc_ref = _db.collection("calls").document()
                doc_ref.set(call_data)
                return doc_ref.id
            except Exception as e:
                logger.error(f"Error logging call start: {e}")

        logger.info(f"[MOCK] Call started: {call_data}")
        return f"mock-call-{room_name}"

    async def update_call_status(
        self,
        call_id: str,
        status: str,
        **extra_fields: Any,
    ) -> None:
        """Update call status in Firestore."""
        update_data = {"status": status, **extra_fields}

        if self._use_firebase and _db:
            try:
                _db.collection("calls").document(call_id).update(update_data)
                return
            except Exception as e:
                logger.error(f"Error updating call status: {e}")

        logger.info(f"[MOCK] Call {call_id} updated: {update_data}")

    async def request_handoff(self, call_id: str, reason: str = "") -> None:
        """Mark a call as needing human handoff."""
        await self.update_call_status(
            call_id,
            status="handoff",
            handoff_requested=True,
            handoff_reason=reason,
            handoff_requested_at=datetime.now(timezone.utc).isoformat(),
        )

    async def append_transcript(
        self,
        call_id: str,
        role: str,
        text: str,
    ) -> None:
        """Append a transcript entry to a call."""
        entry = {
            "role": role,
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if self._use_firebase and _db:
            try:
                from google.cloud.firestore import ArrayUnion
                _db.collection("calls").document(call_id).update({
                    "transcript": ArrayUnion([entry])
                })
                return
            except Exception as e:
                logger.error(f"Error appending transcript: {e}")

        logger.info(f"[MOCK] Transcript for {call_id}: [{role}] {text}")
