"""
Embedding service — Hugging Face sentence-transformers.

Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
- 384-dimensional vectors
- Multilingual (English, Telugu, Hindi, and 50+ more)
- Runs fully locally — no API key required

Pinecone index: rag-chatbot-hf  (384 dims, cosine, serverless AWS us-east-1)
NOTE: The index must be created manually in the Pinecone console before use.
      This service will NOT auto-create the index to avoid accidental duplication.
"""
import logging
from typing import List
from functools import lru_cache

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Sentence-Transformers model (loaded once, cached) ───────────────────────

@lru_cache(maxsize=1)
def _get_st_model():
    """Load and cache the sentence-transformers embedding model."""
    from sentence_transformers import SentenceTransformer
    import os
    # Suppress symlink warning on Windows
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
    model = SentenceTransformer(settings.EMBEDDING_MODEL)
    logger.info(f"Embedding model loaded — dimension: {model.get_sentence_embedding_dimension()}")
    return model


# ─── Pinecone index ──────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_pinecone_index():
    """
    Return a handle to the existing Pinecone index.

    IMPORTANT: This function does NOT create the index automatically.
    You must create it manually in the Pinecone console with:
      - Name:       rag-chatbot-hf
      - Dimensions: 384
      - Metric:     cosine
      - Type:       Serverless (AWS us-east-1)

    The old rag-chatbot index (1536 dims) is left untouched.
    """
    from pinecone import Pinecone

    if not settings.PINECONE_API_KEY:
        raise RuntimeError("PINECONE_API_KEY is not set in environment variables.")

    pc = Pinecone(api_key=settings.PINECONE_API_KEY)

    existing_names = [idx.name for idx in pc.list_indexes()]
    if settings.PINECONE_INDEX_NAME not in existing_names:
        raise RuntimeError(
            f"Pinecone index '{settings.PINECONE_INDEX_NAME}' does not exist. "
            f"Please create it manually in the Pinecone console:\n"
            f"  Name:       {settings.PINECONE_INDEX_NAME}\n"
            f"  Dimensions: {settings.EMBEDDING_DIMENSION}\n"
            f"  Metric:     cosine\n"
            f"  Type:       Serverless — AWS us-east-1\n"
            f"Existing indexes: {existing_names}"
        )

    logger.info(f"Connected to Pinecone index: {settings.PINECONE_INDEX_NAME}")
    return pc.Index(settings.PINECONE_INDEX_NAME)


# ─── Embedding generation ────────────────────────────────────────────────────

async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate 384-dimensional embeddings for a list of texts using
    sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2.

    Runs entirely locally — no API key or network call required after
    the model is downloaded on first use.
    """
    if not texts:
        return []

    model = _get_st_model()

    # Clean inputs
    cleaned = [t.replace("\n", " ").strip() for t in texts if t.strip()]
    if not cleaned:
        return []

    # sentence-transformers encode() is synchronous but fast on CPU
    # batch_size controls memory usage
    import asyncio
    loop = asyncio.get_event_loop()
    embeddings = await loop.run_in_executor(
        None,
        lambda: model.encode(cleaned, batch_size=32, show_progress_bar=False).tolist(),
    )

    # Safety check
    if embeddings and len(embeddings[0]) != settings.EMBEDDING_DIMENSION:
        raise ValueError(
            f"Embedding dimension mismatch: expected {settings.EMBEDDING_DIMENSION}, "
            f"got {len(embeddings[0])}. Check EMBEDDING_MODEL in config."
        )

    return embeddings


async def get_single_embedding(text: str) -> List[float]:
    """Get a single 384-dim embedding for a query string."""
    results = await get_embeddings([text])
    if results:
        return results[0]
    # Return zero vector as safe fallback (will not match anything in Pinecone)
    return [0.0] * settings.EMBEDDING_DIMENSION
