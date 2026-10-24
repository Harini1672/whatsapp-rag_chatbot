from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.database import get_supabase
from app.models import TokenData
from datetime import datetime, timezone, timedelta
from collections import Counter

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def get_dashboard(current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    org_id = current_user.org_id

    # Stats
    convs = db.table("conversations").select("id, status, last_message_at, user_phone").eq("org_id", org_id).execute()
    msgs = db.table("messages").select("id, role, created_at, content, conversation_id").eq("org_id", org_id).execute()
    events = db.table("analytics_events").select("event_type, created_at, metadata").eq("org_id", org_id).execute()
    feedback = db.table("feedback").select("rating").eq("org_id", org_id).execute()
    support = db.table("support_requests").select("id, status").eq("org_id", org_id).execute()
    wa_conn = db.table("whatsapp_connections").select("status").eq("org_id", org_id).eq("status", "connected").maybe_single().execute()

    all_convs = convs.data or []
    all_msgs = msgs.data or []
    all_events = events.data or []
    all_fb = feedback.data or []
    all_support = support.data or []

    active_convs = [c for c in all_convs if c["status"] == "active"]

    # Answered / unanswered from events
    answered = sum(1 for e in all_events if e["event_type"] == "message_answered")
    unanswered = sum(1 for e in all_events if e["event_type"] == "message_unanswered")
    positive_fb = sum(1 for f in all_fb if f["rating"] == "positive")
    positive_pct = round((positive_fb / len(all_fb) * 100) if all_fb else 0)

    # Daily messages (last 14 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    daily: dict[str, int] = {}
    for msg in all_msgs:
        try:
            dt = datetime.fromisoformat(msg["created_at"].replace("Z", "+00:00"))
            if dt > cutoff and msg["role"] == "user":
                day = dt.strftime("%Y-%m-%d")
                daily[day] = daily.get(day, 0) + 1
        except Exception:
            pass

    daily_messages = [{"date": k, "count": v} for k, v in sorted(daily.items())]

    # Top questions
    questions = []
    for e in all_events:
        meta = e.get("metadata") or {}
        q = meta.get("question", "")
        if q:
            questions.append(q[:60])
    top_counter = Counter(questions).most_common(5)
    top_questions = [{"question": q, "count": c} for q, c in top_counter]

    # Recent conversations (last 10)
    recent_convs = sorted(all_convs, key=lambda x: x.get("last_message_at", ""), reverse=True)[:10]
    recent_with_msgs = []
    msg_map = {}
    for msg in all_msgs:
        cid = msg["conversation_id"]
        if cid not in msg_map:
            msg_map[cid] = msg["content"]

    for conv in recent_convs:
        recent_with_msgs.append({
            "id": conv["id"],
            "user_phone": conv.get("user_phone", ""),
            "last_message": msg_map.get(conv["id"], ""),
            "status": conv["status"],
            "last_message_at": conv.get("last_message_at", ""),
        })

    return {
        "stats": {
            "total_messages": len([m for m in all_msgs if m["role"] == "user"]),
            "total_conversations": len(all_convs),
            "active_conversations": len(active_convs),
            "answered": answered,
            "unanswered": unanswered,
            "support_requests": len(all_support),
            "positive_feedback": positive_pct,
        },
        "daily_messages": daily_messages,
        "top_questions": top_questions,
        "recent_conversations": recent_with_msgs,
        "whatsapp_connected": wa_conn.data is not None,
    }


@router.get("/summary")
async def get_summary(current_user: TokenData = Depends(get_current_user)):
    """Full analytics summary page data."""
    dashboard = await get_dashboard(current_user)
    stats = dashboard["stats"]
    all_fb_result = get_supabase().table("feedback").select("rating").eq("org_id", current_user.org_id).execute()
    all_fb = all_fb_result.data or []
    negative = sum(1 for f in all_fb if f["rating"] == "negative")

    return {
        "total_messages": stats["total_messages"],
        "total_conversations": stats["total_conversations"],
        "active_conversations": stats["active_conversations"],
        "answered_questions": stats["answered"],
        "unanswered_questions": stats["unanswered"],
        "support_requests": stats["support_requests"],
        "positive_feedback": sum(1 for f in all_fb if f["rating"] == "positive"),
        "negative_feedback": negative,
        "daily_messages": dashboard["daily_messages"],
        "top_questions": dashboard["top_questions"],
    }
