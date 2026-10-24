"""
Document processing service.
Extracts text from PDF / DOCX / TXT, chunks it, generates embeddings,
and upserts into Pinecone.
"""
import io
import uuid
import logging
from typing import List
from fastapi import UploadFile

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings
from app.database import get_supabase
from app.services.embedding_service import get_embeddings, get_pinecone_index

logger = logging.getLogger(__name__)
settings = get_settings()


def _extract_text_pdf(file_bytes: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_text_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_text_txt(file_bytes: bytes) -> str:
    import chardet
    detected = chardet.detect(file_bytes)
    encoding = detected.get("encoding") or "utf-8"
    return file_bytes.decode(encoding, errors="replace")


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extract plain text from uploaded file."""
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _extract_text_pdf(file_bytes)
    elif lower.endswith(".docx"):
        return _extract_text_docx(file_bytes)
    elif lower.endswith(".txt"):
        return _extract_text_txt(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {filename}")


def chunk_text(text: str) -> List[str]:
    """Split text into overlapping chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


async def process_document(
    document_id: str,
    file_bytes: bytes,
    filename: str,
    org_id: str,
    chatbot_id: str,
) -> int:
    """
    Full processing pipeline:
    1. Extract text
    2. Chunk
    3. Embed
    4. Upsert to Pinecone
    5. Update Supabase status
    Returns number of chunks created.
    """
    db = get_supabase()

    # Mark as processing
    db.table("documents").update({"status": "processing"}).eq("id", document_id).execute()

    try:
        text = extract_text(file_bytes, filename)
        if not text.strip():
            raise ValueError("No text could be extracted from the document.")

        chunks = chunk_text(text)
        if not chunks:
            raise ValueError("Text chunking produced no results.")

        # Generate embeddings
        embeddings = await get_embeddings(chunks)

        # Upsert to Pinecone
        index = get_pinecone_index()
        vectors = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            vector_id = f"{document_id}_{i}"
            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": {
                    "org_id": org_id,
                    "chatbot_id": chatbot_id,
                    "document_id": document_id,
                    "document_name": filename,
                    "chunk_index": i,
                    "text": chunk[:1000],  # Pinecone metadata limit
                },
            })

        # Upsert in batches of 100
        batch_size = 100
        for batch_start in range(0, len(vectors), batch_size):
            batch = vectors[batch_start:batch_start + batch_size]
            index.upsert(vectors=batch, namespace=org_id)

        # Mark as indexed
        db.table("documents").update({
            "status": "indexed",
            "chunk_count": len(chunks),
            "error_message": None,
        }).eq("id", document_id).execute()

        logger.info(f"Document {document_id} indexed with {len(chunks)} chunks")
        return len(chunks)

    except Exception as e:
        logger.error(f"Document processing failed for {document_id}: {e}")
        db.table("documents").update({
            "status": "error",
            "error_message": str(e)[:500],
        }).eq("id", document_id).execute()
        raise


async def delete_document_embeddings(document_id: str, org_id: str) -> None:
    """Delete all Pinecone vectors for a document."""
    try:
        index = get_pinecone_index()
        # List and delete by prefix (Pinecone v3+)
        # For smaller indexes: fetch by metadata filter
        index.delete(filter={"document_id": document_id}, namespace=org_id)
    except Exception as e:
        logger.warning(f"Could not delete embeddings for {document_id}: {e}")
