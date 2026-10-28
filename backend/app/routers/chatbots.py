from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.database import get_supabase
from app.models import ChatbotCreate, ChatbotUpdate, TokenData
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/chatbots", tags=["Chatbots"])


@router.get("")
async def list_chatbots(current_user: TokenData = Depends(get_current_user)):
    if not current_user.org_id:
        return {"items": []}
    db = get_supabase()
    result = (
        db.table("chatbots")
        .select("*")
        .eq("org_id", current_user.org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": result.data or []}


@router.post("")
async def create_chatbot(data: ChatbotCreate, current_user: TokenData = Depends(get_current_user)):
    if not current_user.org_id:
        raise HTTPException(400, "Organization not set up. Please log out and log in again.")
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid.uuid4()),
        "org_id": current_user.org_id,
        **data.model_dump(),
        "tone": data.tone.value,
        "response_mode": data.response_mode.value,
        "created_at": now,
        "updated_at": now,
    }
    result = db.table("chatbots").insert(record).execute()
    return result.data[0] if result.data else record


@router.get("/{chatbot_id}")
async def get_chatbot(chatbot_id: str, current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    result = (
        db.table("chatbots")
        .select("*")
        .eq("id", chatbot_id)
        .eq("org_id", current_user.org_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Chatbot not found")
    return result.data


@router.put("/{chatbot_id}")
async def update_chatbot(chatbot_id: str, data: ChatbotUpdate, current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    update_data = {
        **data.model_dump(),
        "tone": data.tone.value,
        "response_mode": data.response_mode.value,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = (
        db.table("chatbots")
        .update(update_data)
        .eq("id", chatbot_id)
        .eq("org_id", current_user.org_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Chatbot not found")
    return result.data[0]


@router.delete("/{chatbot_id}")
async def delete_chatbot(chatbot_id: str, current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    db.table("chatbots").delete().eq("id", chatbot_id).eq("org_id", current_user.org_id).execute()
    return {"message": "Deleted"}
