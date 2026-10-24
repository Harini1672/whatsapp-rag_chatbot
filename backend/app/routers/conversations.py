from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import get_current_user
from app.database import get_supabase
from app.models import TokenData, AdminReplyRequest
from app.services.wasender_service import WasenderClient
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("")
async def list_conversations(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    current_user: TokenData = Depends(get_current_user),
):
    db = get_supabase()
    result = (
        db.table("conversations")
        .select("*, chatbots(name)")
        .eq("org_id", current_user.org_id)
        .order("last_message_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    items = []
    for row in (result.data or []):
        chatbot_data = row.pop("chatbots", None)
        row["chatbot_name"] = chatbot_data["name"] if chatbot_data else ""
        items.append(row)
    return {"items": items}


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    limit: int = Query(default=100, le=500),
    current_user: TokenData = Depends(get_current_user),
):
    db = get_supabase()
    # Verify conversation belongs to org
    conv = (
        db.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("org_id", current_user.org_id)
        .maybe_single()
        .execute()
    )
    if not conv.data:
        raise HTTPException(404, "Conversation not found")

    result = (
        db.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return {"items": result.data or []}


@router.post("/{conversation_id}/reply")
async def admin_reply(
    conversation_id: str,
    data: AdminReplyRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Admin sends a manual reply during human takeover."""
    db = get_supabase()

    conv = (
        db.table("conversations")
        .select("chatbot_id")
        .eq("id", conversation_id)
        .eq("org_id", current_user.org_id)
        .maybe_single()
        .execute()
    )
    if not conv.data:
        raise HTTPException(404, "Conversation not found")

    # Get WhatsApp connection
    conn = (
        db.table("whatsapp_connections")
        .select("api_key, session_id")
        .eq("org_id", current_user.org_id)
        .eq("status", "connected")
        .maybe_single()
        .execute()
    )
    if not conn.data:
        raise HTTPException(400, "WhatsApp not connected")

    wa_client = WasenderClient(api_key=conn.data["api_key"], session_id=conn.data["session_id"])

    try:
        await wa_client.send_text(data.user_phone, data.message)
    except Exception as e:
        raise HTTPException(500, f"Failed to send: {e}")

    # Store message
    import uuid
    from datetime import datetime, timezone
    db.table("messages").insert({
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "org_id": current_user.org_id,
        "role": "assistant",
        "content": f"[HUMAN] {data.message}",
        "message_type": "text",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    return {"message": "Sent"}
