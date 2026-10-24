"""
WasenderAPI client service.
Sends text and audio messages via the WasenderAPI REST API.

API documentation: https://wasenderapi.com/api-docs
"""
import logging
import hashlib
import hmac
import base64
import httpx
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class WasenderClient:
    """Thin HTTP client for WasenderAPI."""

    BASE_URL = "https://api.wasenderapi.com/api"

    def __init__(self, api_key: str, session_id: str):
        self.api_key = api_key
        self.session_id = session_id
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def send_text(self, phone: str, message: str) -> dict:
        """Send a text message to a WhatsApp number."""
        phone_clean = phone.strip().replace("+", "").replace(" ", "")
        payload = {
            "to": f"{phone_clean}@s.whatsapp.net",
            "text": message,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.BASE_URL}/sendText",
                json=payload,
                headers=self.headers,
            )
        if resp.status_code not in (200, 201):
            logger.error(f"WasenderAPI error {resp.status_code}: {resp.text}")
            raise Exception(f"WasenderAPI returned {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    async def send_audio(self, phone: str, audio_url: str, caption: str = "") -> dict:
        """Send an audio message."""
        phone_clean = phone.strip().replace("+", "").replace(" ", "")
        payload = {
            "to": f"{phone_clean}@s.whatsapp.net",
            "mediaUrl": audio_url,
            "mediaType": "audio",
            "caption": caption,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.BASE_URL}/sendMedia",
                json=payload,
                headers=self.headers,
            )
        if resp.status_code not in (200, 201):
            raise Exception(f"WasenderAPI returned {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    async def get_session_status(self) -> dict:
        """Check the session connection status."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.BASE_URL}/session/status",
                headers=self.headers,
            )
        return resp.json() if resp.status_code == 200 else {"status": "error"}


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify the X-Webhook-Signature header from WasenderAPI.
    The signature is an HMAC-SHA256 of the raw request body.
    """
    if not secret:
        return True  # Skip verification if no secret configured
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def get_wasender_client(api_key: str, session_id: str) -> WasenderClient:
    return WasenderClient(api_key=api_key, session_id=session_id)


def parse_webhook_message(payload: dict) -> Optional[dict]:
    """
    Parse WasenderAPI webhook payload into a normalised message dict.
    Returns None for non-message events.

    Payload structure (from WasenderAPI docs):
    {
      "event": "messages.upsert",
      "data": {
        "messages": {
          "key": { "id": "...", "remoteJid": "...", "cleanedSenderPn": "+91..." },
          "messageBody": "Hello",
          "message": {
            "audioMessage": { "url": "...", "mediaKey": "...", "mimetype": "audio/ogg" }
          }
        }
      }
    }
    """
    event = payload.get("event", "")
    if "messages" not in event and "message" not in event:
        return None

    data = payload.get("data", {})
    message_data = data.get("messages", {})
    if not message_data:
        return None

    key = message_data.get("key", {})
    sender = (
        key.get("cleanedParticipantPn")
        or key.get("cleanedSenderPn")
        or key.get("remoteJid", "")
    )

    # Skip messages sent by the bot itself
    if key.get("fromMe", False):
        return None

    text_body = message_data.get("messageBody", "")
    inner_msg = message_data.get("message", {})

    # Detect audio
    audio_info = inner_msg.get("audioMessage") or inner_msg.get("pttMessage")
    has_audio = audio_info is not None

    return {
        "sender_phone": sender,
        "text": text_body,
        "message_id": key.get("id", ""),
        "has_audio": has_audio,
        "audio_info": audio_info or {},
        "raw": message_data,
    }
