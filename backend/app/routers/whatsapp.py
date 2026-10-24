import logging
import uuid
import hmac
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import JSONResponse

from app.auth import get_current_user
from app.database import get_supabase
from app.models import TokenData, WhatsAppConnectRequest
from app.config import get_settings
from app.services.wasender_service import WasenderClient, parse_webhook_message
from app.services.message_processor import process_incoming_message

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.get("/status")
async def get_status(current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    result = (
        db.table("whatsapp_connections")
        .select("*")
        .eq("org_id", current_user.org_id)
        .eq("status", "connected")
        .maybe_single()
        .execute()
    )
    if result.data:
        return {
            "connected": True,
            "phone_number": result.data.get("phone_number"),
            "session_id": result.data.get("session_id"),
            "chatbot_id": result.data.get("chatbot_id"),
        }
    return {"connected": False}


@router.get("/webhook-url")
async def get_webhook_url(current_user: TokenData = Depends(get_current_user)):
    return {"url": f"{settings.BACKEND_URL}/api/whatsapp/webhook/{current_user.org_id}"}


@router.get("/qr-data/{chatbot_id}")
async def get_qr_data(chatbot_id: str, current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    conn = (
        db.table("whatsapp_connections")
        .select("phone_number")
        .eq("chatbot_id", chatbot_id)
        .eq("org_id", current_user.org_id)
        .maybe_single()
        .execute()
    )
    bot = (
        db.table("chatbots")
        .select("welcome_message, name")
        .eq("id", chatbot_id)
        .maybe_single()
        .execute()
    )
    phone = conn.data.get("phone_number", "") if conn.data else ""
    welcome = bot.data.get("welcome_message", "Hello!") if bot.data else "Hello!"
    clean_phone = phone.replace("+", "").replace(" ", "")
    wa_link = f"https://wa.me/{clean_phone}?text={welcome}" if clean_phone else ""
    return {
        "phone_number": phone,
        "welcome_message": welcome,
        "whatsapp_link": wa_link,
    }


@router.post("/connect")
async def connect_whatsapp(data: WhatsAppConnectRequest, current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Test connection
    client = WasenderClient(api_key=data.api_key, session_id=data.session_id)
    try:
        status = await client.get_session_status()
    except Exception as e:
        raise HTTPException(400, f"Could not verify WasenderAPI credentials: {e}")

    # Upsert connection record
    existing = (
        db.table("whatsapp_connections")
        .select("id")
        .eq("org_id", current_user.org_id)
        .eq("chatbot_id", data.chatbot_id)
        .maybe_single()
        .execute()
    )

    webhook_url = f"{settings.BACKEND_URL}/api/whatsapp/webhook/{current_user.org_id}"

    record = {
        "org_id": current_user.org_id,
        "chatbot_id": data.chatbot_id,
        "session_id": data.session_id,
        "api_key": data.api_key,
        "phone_number": data.phone_number,
        "status": "connected",
        "webhook_url": webhook_url,
        "updated_at": now,
    }

    if existing.data:
        db.table("whatsapp_connections").update(record).eq("id", existing.data["id"]).execute()
    else:
        db.table("whatsapp_connections").insert({"id": str(uuid.uuid4()), "created_at": now, **record}).execute()

    return {"message": "WhatsApp connected successfully", "webhook_url": webhook_url}


@router.post("/disconnect")
async def disconnect_whatsapp(current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    db.table("whatsapp_connections").update({"status": "disconnected"}).eq("org_id", current_user.org_id).execute()
    return {"message": "Disconnected"}


@router.post("/webhook/{org_id}")
async def webhook(
    org_id: str,
    request: Request,
    x_webhook_signature: str = Header(None, alias="X-Webhook-Signature"),
):
    """
    Receive webhook events from WasenderAPI.
    Verifies signature, parses message, triggers RAG pipeline.
    """
    raw_body = await request.body()

    db = get_supabase()

    # Get connection for this org
    conn = (
        db.table("whatsapp_connections")
        .select("*")
        .eq("org_id", org_id)
        .eq("status", "connected")
        .maybe_single()
        .execute()
    )

    if not conn.data:
        logger.warning(f"Webhook received for unknown org: {org_id}")
        return JSONResponse({"ok": True})  # Still 200 to avoid retries

    connection = conn.data

    # Verify signature (if webhook secret is stored)
    webhook_secret = connection.get("webhook_secret", "")
    if webhook_secret and x_webhook_signature:
        expected = hmac.new(webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, x_webhook_signature):
            logger.warning("Webhook signature mismatch")
            return JSONResponse({"ok": True})

    try:
        payload = await request.json()
    except Exception:
        return JSONResponse({"ok": True})

    # Parse message
    msg = parse_webhook_message(payload)
    if not msg:
        return JSONResponse({"ok": True})  # Not a user message event

    # Get chatbot config
    chatbot_id = connection["chatbot_id"]
    bot_result = db.table("chatbots").select("*").eq("id", chatbot_id).maybe_single().execute()
    if not bot_result.data:
        logger.warning(f"No chatbot found for connection {connection.get('id')}")
        return JSONResponse({"ok": True})

    chatbot_config = bot_result.data

    # Process asynchronously — return 200 immediately
    wa_client = WasenderClient(api_key=connection["api_key"], session_id=connection["session_id"])

    import asyncio
    asyncio.create_task(
        process_incoming_message(
            sender_phone=msg["sender_phone"],
            text=msg["text"],
            has_audio=msg["has_audio"],
            audio_info=msg["audio_info"],
            org_id=org_id,
            chatbot_id=chatbot_id,
            chatbot_config=chatbot_config,
            wa_client=wa_client,
            wa_message_id=msg["message_id"],
        )
    )

    return JSONResponse({"ok": True})
