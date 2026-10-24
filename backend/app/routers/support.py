from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.database import get_supabase
from app.models import TokenData, SupportStatusUpdate
from datetime import datetime, timezone

router = APIRouter(prefix="/support", tags=["Support"])


@router.get("")
async def list_support_requests(current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    result = (
        db.table("support_requests")
        .select("*")
        .eq("org_id", current_user.org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": result.data or []}


@router.patch("/{request_id}")
async def update_support_request(
    request_id: str,
    data: SupportStatusUpdate,
    current_user: TokenData = Depends(get_current_user),
):
    db = get_supabase()
    result = (
        db.table("support_requests")
        .update({
            "status": data.status,
            "admin_notes": data.admin_notes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", request_id)
        .eq("org_id", current_user.org_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Request not found")
    return result.data[0]


@router.post("/{request_id}/resolve")
async def resolve_and_resume(request_id: str, current_user: TokenData = Depends(get_current_user)):
    """Resolve support request and resume AI responses."""
    db = get_supabase()
    # Get the request
    req = (
        db.table("support_requests")
        .select("conversation_id")
        .eq("id", request_id)
        .eq("org_id", current_user.org_id)
        .maybe_single()
        .execute()
    )
    if not req.data:
        raise HTTPException(404, "Request not found")

    # Update request
    db.table("support_requests").update({
        "status": "resolved",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", request_id).execute()

    # Resume AI on conversation
    db.table("conversations").update({"status": "active"}).eq("id", req.data["conversation_id"]).execute()

    return {"message": "Resolved and AI responses resumed"}
