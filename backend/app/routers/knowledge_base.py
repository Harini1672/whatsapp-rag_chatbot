from fastapi import APIRouter, Depends, BackgroundTasks
from app.auth import get_current_user
from app.database import get_supabase
from app.models import KBSearchRequest, TokenData
from app.services.rag_service import retrieve_chunks
from app.services.document_service import process_document, delete_document_embeddings
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/knowledge-base", tags=["Knowledge Base"])


@router.get("/stats")
async def get_stats(current_user: TokenData = Depends(get_current_user)):
    db = get_supabase()
    docs = db.table("documents").select("id, status, chunk_count, updated_at").eq("org_id", current_user.org_id).execute()
    all_docs = docs.data or []
    total_chunks = sum(d.get("chunk_count", 0) for d in all_docs)
    indexed = sum(1 for d in all_docs if d.get("status") == "indexed")
    last_updated = max((d.get("updated_at", "") for d in all_docs), default=None)
    return {
        "total_documents": len(all_docs),
        "total_chunks": total_chunks,
        "indexed_documents": indexed,
        "last_updated": last_updated,
    }


@router.post("/search")
async def search_kb(data: KBSearchRequest, current_user: TokenData = Depends(get_current_user)):
    chunks = await retrieve_chunks(
        query=data.query,
        org_id=current_user.org_id,
        chatbot_id=data.chatbot_id,
        top_k=data.top_k,
    )
    return {
        "query": data.query,
        "results": [
            {
                "document_name": c["document_name"],
                "chunk_text": c["text"],
                "score": c["score"],
                "document_id": c["document_id"],
            }
            for c in chunks
        ],
    }


@router.post("/reindex-all/{chatbot_id}")
async def reindex_all(
    chatbot_id: str,
    background_tasks: BackgroundTasks,
    current_user: TokenData = Depends(get_current_user),
):
    db = get_supabase()
    docs = (
        db.table("documents")
        .select("*")
        .eq("org_id", current_user.org_id)
        .eq("chatbot_id", chatbot_id)
        .execute()
    )
    count = 0
    for doc in (docs.data or []):
        try:
            file_bytes = db.storage.from_("documents").download(doc["file_path"])
            await delete_document_embeddings(doc["id"], current_user.org_id)
            background_tasks.add_task(
                process_document,
                doc["id"],
                file_bytes,
                doc["name"],
                current_user.org_id,
                chatbot_id,
            )
            count += 1
        except Exception as e:
            logger.warning(f"Could not queue {doc['id']}: {e}")

    return {"message": f"Queued {count} documents for reindexing"}
