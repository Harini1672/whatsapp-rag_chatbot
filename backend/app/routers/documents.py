import uuid
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks

from app.auth import get_current_user
from app.database import get_supabase
from app.models import TokenData
from app.services.document_service import process_document, delete_document_embeddings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("")
async def list_documents(current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    result = (
        db.table("documents")
        .select("*")
        .eq("org_id", current_user.org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": result.data or []}


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    chatbot_id: str = Form(...),
    current_user: TokenData = Depends(get_current_user),
):
    # Validate file size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(400, f"File exceeds 10MB limit ({len(file_bytes) / 1024 / 1024:.1f} MB)")

    # Validate type by filename
    filename = file.filename or "unknown"
    allowed_exts = (".pdf", ".docx", ".txt")
    if not any(filename.lower().endswith(ext) for ext in allowed_exts):
        raise HTTPException(400, f"Unsupported file type. Allowed: {', '.join(allowed_exts)}")

    db = get_supabase()

    # Verify chatbot belongs to org
    bot = db.table("chatbots").select("id").eq("id", chatbot_id).eq("org_id", current_user.org_id).maybe_single().execute()
    if not bot.data:
        raise HTTPException(404, "Chatbot not found")

    # Upload to Supabase Storage
    storage_path = f"{current_user.org_id}/{chatbot_id}/{str(uuid.uuid4())}_{filename}"
    try:
        db.storage.from_("documents").upload(storage_path, file_bytes)
    except Exception as e:
        raise HTTPException(500, f"Storage upload failed: {e}")

    # Create document record
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": doc_id,
        "org_id": current_user.org_id,
        "chatbot_id": chatbot_id,
        "name": filename,
        "file_path": storage_path,
        "file_type": filename.rsplit(".", 1)[-1].lower(),
        "file_size": len(file_bytes),
        "status": "pending",
        "chunk_count": 0,
        "error_message": None,
        "created_at": now,
        "updated_at": now,
    }
    db.table("documents").insert(doc).execute()

    # Queue background processing
    background_tasks.add_task(
        process_document,
        doc_id,
        file_bytes,
        filename,
        current_user.org_id,
        chatbot_id,
    )

    return {"message": "Uploaded and queued for indexing", "document_id": doc_id, "name": filename}


@router.post("/{document_id}/reindex")
async def reindex_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: TokenData = Depends(get_current_user),
):
    db = get_supabase()
    result = (
        db.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("org_id", current_user.org_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Document not found")

    doc = result.data

    # Download file from storage
    try:
        file_bytes = db.storage.from_("documents").download(doc["file_path"])
    except Exception as e:
        raise HTTPException(500, f"Could not download file: {e}")

    # Delete old embeddings
    await delete_document_embeddings(document_id, current_user.org_id)

    # Queue reprocessing
    background_tasks.add_task(
        process_document,
        document_id,
        file_bytes,
        doc["name"],
        current_user.org_id,
        doc["chatbot_id"],
    )

    return {"message": "Reindexing started"}


@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    result = (
        db.table("documents")
        .select("file_path")
        .eq("id", document_id)
        .eq("org_id", current_user.org_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Document not found")

    # Delete embeddings
    await delete_document_embeddings(document_id, current_user.org_id)

    # Delete from storage
    try:
        db.storage.from_("documents").remove([result.data["file_path"]])
    except Exception:
        pass

    # Delete record
    db.table("documents").delete().eq("id", document_id).eq("org_id", current_user.org_id).execute()
    return {"message": "Deleted"}
