"""
Central message processor.
Called by the webhook handler for each incoming WhatsApp message.
Orchestrates: voice → RAG → reply → storage → escalation.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.config import get_settings
from app.database import get_supabase
from app.services.rag_service import generate_rag_response, get_conversation_history
from app.services.voice_service import transcribe_audio_url, text_to_speech, detect_language
from app.services.wasender_service import WasenderClient

logger = logging.getLogger(__name__)
settings = get_settings()

# Feedback trigger — after 5 bot replies ask for feedback
FEEDBACK_EVERY_N = 5


async def process_incoming_message(
    sender_phone: str,
    text: str,
    has_audio: bool,
    audio_info: dict,
    org_id: str,
    chatbot_id: str,
    chatbot_config: dict,
    wa_client: WasenderClient,
    wa_message_id: str = "",
) -> None:
    """Main entry point — process one incoming WhatsApp message end-to-end."""
    db = get_supabase()

    # 1. Get or create conversation
    conversation_id = await _get_or_create_conversation(db, sender_phone, org_id, chatbot_id)

    # 2. Check if human takeover is active
    conv_data = db.table("conversations").select("status").eq("id", conversation_id).maybe_single().execute()
    if conv_data.data and conv_data.data.get("status") == "human_takeover":
        logger.info(f"Conversation {conversation_id} is in human takeover — skipping AI")
        return

    # 3. Check for feedback responses ("1" or "2")
    if text.strip() in ("1", "2") and await _is_pending_feedback(db, conversation_id):
        await _store_feedback(db, conversation_id, org_id, text.strip())
        await wa_client.send_text(sender_phone, "Thank you for your feedback! 😊")
        return

    # 4. Resolve text query
    query_text = text
    response_mode = chatbot_config.get("response_mode", "text")

    if has_audio and response_mode in ("audio", "audio_to_audio"):
        # STT
        transcribed = await transcribe_audio_url(
            audio_info.get("url", ""),
            audio_info.get("mediaKey", ""),
            "audio",
        )
        if transcribed:
            query_text = transcribed
        else:
            await wa_client.send_text(sender_phone, "Sorry, I couldn't process the audio message. Please try again or type your question.")
            return

    if not query_text.strip():
        return

    # 5. Language detection for auto mode
    detected_lang = "en"
    if chatbot_config.get("language") == "auto":
        detected_lang = await detect_language(query_text)

    # 6. Store user message
    msg_id = str(uuid.uuid4())
    db.table("messages").insert({
        "id": msg_id,
        "conversation_id": conversation_id,
        "org_id": org_id,
        "role": "user",
        "content": query_text,
        "message_type": "audio" if has_audio else "text",
        "wa_message_id": wa_message_id,
    }).execute()

    # 7. Get conversation history for memory
    history = await get_conversation_history(conversation_id)

    # 8. RAG response
    effective_config = {**chatbot_config}
    if chatbot_config.get("language") == "auto":
        effective_config["language"] = detected_lang

    response_text, sources, confidence = await generate_rag_response(
        query=query_text,
        org_id=org_id,
        chatbot_id=chatbot_id,
        conversation_history=history,
        chatbot_config=effective_config,
    )

    # 9. Escalation check
    threshold = chatbot_config.get("confidence_threshold", 0.5)
    unanswered = confidence < threshold

    if unanswered and chatbot_config.get("human_support_enabled", True):
        await _create_support_request(db, conversation_id, org_id, sender_phone, query_text, wa_client)
        return

    # 10. Store bot response
    bot_msg_id = str(uuid.uuid4())
    db.table("messages").insert({
        "id": bot_msg_id,
        "conversation_id": conversation_id,
        "org_id": org_id,
        "role": "assistant",
        "content": response_text,
        "message_type": "text",
        "source_documents": sources,
        "confidence_score": confidence,
    }).execute()

    # 11. Track analytics event
    db.table("analytics_events").insert({
        "org_id": org_id,
        "chatbot_id": chatbot_id,
        "event_type": "message_answered" if not unanswered else "message_unanswered",
        "metadata": {"question": query_text[:200], "confidence": confidence},
    }).execute()

    # 12. Send response
    if response_mode in ("text_to_audio", "audio_to_audio"):
        audio_bytes = await text_to_speech(response_text, detected_lang)
        if audio_bytes:
            # Upload to Supabase Storage and get public URL
            audio_url = await _upload_audio(audio_bytes, org_id, bot_msg_id)
            if audio_url:
                await wa_client.send_audio(sender_phone, audio_url)
            else:
                # Fallback to text
                await wa_client.send_text(sender_phone, response_text)
        else:
            await wa_client.send_text(sender_phone, response_text)
    else:
        # Append source info if available
        final_msg = response_text
        if sources:
            source_names = ", ".join(set(s["document_name"] for s in sources[:2]))
            final_msg += f"\n\n_Source: {source_names}_"
        await wa_client.send_text(sender_phone, final_msg)

    # 13. Periodic feedback request
    await _maybe_ask_for_feedback(db, conversation_id, sender_phone, wa_client, chatbot_config)

    # 14. Update conversation
    db.table("conversations").update({
        "last_message_at": datetime.now(timezone.utc).isoformat(),
        "message_count": _get_message_count(db, conversation_id),
    }).eq("id", conversation_id).execute()


async def _get_or_create_conversation(db, sender_phone: str, org_id: str, chatbot_id: str) -> str:
    result = (
        db.table("conversations")
        .select("id")
        .eq("user_phone", sender_phone)
        .eq("chatbot_id", chatbot_id)
        .eq("org_id", org_id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    if result.data:
        return result.data["id"]

    conv_id = str(uuid.uuid4())
    db.table("conversations").insert({
        "id": conv_id,
        "org_id": org_id,
        "chatbot_id": chatbot_id,
        "user_phone": sender_phone,
        "status": "active",
        "message_count": 0,
        "last_message_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return conv_id


async def _create_support_request(db, conversation_id: str, org_id: str, sender_phone: str, reason: str, wa_client: WasenderClient) -> None:
    db.table("support_requests").insert({
        "conversation_id": conversation_id,
        "org_id": org_id,
        "user_phone": sender_phone,
        "reason": reason[:500],
        "status": "pending",
    }).execute()

    db.table("conversations").update({"status": "human_takeover"}).eq("id", conversation_id).execute()

    await wa_client.send_text(
        sender_phone,
        "I don't have enough information to answer that accurately. I've created a support request and a human agent will get back to you shortly. 🙏"
    )


async def _is_pending_feedback(db, conversation_id: str) -> bool:
    """Check if the bot recently asked for feedback."""
    result = (
        db.table("messages")
        .select("content")
        .eq("conversation_id", conversation_id)
        .eq("role", "assistant")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        content = result.data[0].get("content", "")
        return "Was this response helpful?" in content
    return False


async def _store_feedback(db, conversation_id: str, org_id: str, rating_text: str) -> None:
    result = (
        db.table("messages")
        .select("id")
        .eq("conversation_id", conversation_id)
        .eq("role", "assistant")
        .order("created_at", desc=True)
        .limit(2)
        .execute()
    )
    msg_id = result.data[1]["id"] if result.data and len(result.data) > 1 else None
    if msg_id:
        db.table("feedback").insert({
            "message_id": msg_id,
            "conversation_id": conversation_id,
            "org_id": org_id,
            "rating": "positive" if rating_text == "1" else "negative",
        }).execute()


async def _maybe_ask_for_feedback(db, conversation_id: str, sender_phone: str, wa_client: WasenderClient, config: dict) -> None:
    result = (
        db.table("messages")
        .select("id")
        .eq("conversation_id", conversation_id)
        .eq("role", "assistant")
        .execute()
    )
    count = len(result.data or [])
    if count > 0 and count % FEEDBACK_EVERY_N == 0:
        await wa_client.send_text(
            sender_phone,
            "Was this response helpful?\n1️⃣ Yes\n2️⃣ No\n\nReply with 1 or 2."
        )


async def _upload_audio(audio_bytes: bytes, org_id: str, msg_id: str) -> Optional[str]:
    """Upload TTS audio to Supabase Storage and return public URL."""
    db = get_supabase()
    path = f"tts/{org_id}/{msg_id}.mp3"
    try:
        db.storage.from_("audio-responses").upload(path, audio_bytes, {"content-type": "audio/mpeg"})
        return db.storage.from_("audio-responses").get_public_url(path)
    except Exception as e:
        logger.error(f"Audio upload failed: {e}")
        return None


def _get_message_count(db, conversation_id: str) -> int:
    result = (
        db.table("messages")
        .select("id", count="exact")
        .eq("conversation_id", conversation_id)
        .execute()
    )
    return result.count or 0
