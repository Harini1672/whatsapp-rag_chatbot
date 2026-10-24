"""
RAG pipeline:
1. Embed user query              — sentence-transformers (384 dims, local)
2. Search Pinecone               — filtered by org + chatbot, index rag-chatbot-hf
3. Build LLM context             — retrieved chunks + conversation history
4. Generate response             — Qwen/Qwen3-4B (local, fallback to Qwen3-1.7B)
5. Return response + sources     — unchanged from original structure

Everything except the LLM call is identical to the original implementation.
"""
import logging
from typing import List, Dict, Tuple

from app.config import get_settings
from app.services.embedding_service import get_single_embedding, get_pinecone_index
from app.database import get_supabase

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Qwen LLM (loaded once, cached) ─────────────────────────────────────────

_qwen_pipeline = None  # module-level cache


def _get_qwen_pipeline():
    """
    Load Qwen3-4B using the Hugging Face transformers text-generation pipeline.
    Falls back to Qwen3-1.7B if the main model fails to load.
    Cached after first load — startup takes ~30–60 s on CPU.
    """
    global _qwen_pipeline
    if _qwen_pipeline is not None:
        return _qwen_pipeline

    import os
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

    from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
    import torch

    def _try_load(model_name: str):
        logger.info(f"Loading LLM: {model_name}")
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float32,   # CPU-safe; use bfloat16 if GPU available
            device_map="auto",
            trust_remote_code=True,
        )
        pipe = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=settings.MAX_TOKENS,
            temperature=0.3,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
        logger.info(f"LLM loaded: {model_name}")
        return pipe

    try:
        _qwen_pipeline = _try_load(settings.LLM_MODEL)
    except Exception as e:
        logger.warning(
            f"Failed to load primary model '{settings.LLM_MODEL}': {e}\n"
            f"Falling back to '{settings.LLM_FALLBACK_MODEL}'"
        )
        _qwen_pipeline = _try_load(settings.LLM_FALLBACK_MODEL)

    return _qwen_pipeline


# ─── Pinecone retrieval (unchanged logic) ────────────────────────────────────

async def retrieve_chunks(
    query: str,
    org_id: str,
    chatbot_id: str,
    top_k: int = None,
) -> List[Dict]:
    """Search Pinecone and return relevant chunks with scores."""
    top_k = top_k or settings.TOP_K_CHUNKS

    if not settings.PINECONE_API_KEY:
        logger.warning("Pinecone not configured — returning empty results")
        return []

    query_embedding = await get_single_embedding(query)
    index = get_pinecone_index()

    try:
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            namespace=org_id,
            filter={"chatbot_id": chatbot_id},
            include_metadata=True,
        )
    except Exception as e:
        logger.error(f"Pinecone query failed: {e}")
        return []

    chunks = []
    for match in results.matches:
        chunks.append({
            "text": match.metadata.get("text", ""),
            "score": match.score,
            "document_id": match.metadata.get("document_id", ""),
            "document_name": match.metadata.get("document_name", "Unknown"),
            "chunk_index": match.metadata.get("chunk_index", 0),
        })
    return chunks


# ─── System prompt builder (unchanged) ───────────────────────────────────────

def _build_system_prompt(personality: str, tone: str, language: str, max_length: int) -> str:
    tone_instructions = {
        "professional": "Respond in a formal, professional manner.",
        "friendly": "Respond in a warm, friendly, conversational tone.",
        "educational": "Explain concepts clearly as if teaching the user.",
        "customer_support": "Be empathetic, patient, and solution-focused.",
    }
    tone_text = tone_instructions.get(tone, "Respond helpfully.")

    lang_text = (
        "Respond in the same language the user is writing in."
        if language == "auto"
        else f"Always respond in {language}."
    )

    return f"""{personality}

{tone_text} {lang_text}

IMPORTANT RULES:
- Answer ONLY based on the context provided below.
- If the context does not contain enough information to answer, say so clearly and offer to connect the user with a human agent.
- Do NOT invent information not present in the context.
- Keep responses under {max_length} characters when possible.
- Be concise and direct.
"""


# ─── Qwen inference helper ───────────────────────────────────────────────────

async def _call_qwen(messages: List[Dict]) -> str:
    """
    Run Qwen inference in a thread executor to avoid blocking the event loop.
    Formats the messages list into a single prompt string using the standard
    chat template format that Qwen3 expects.
    """
    import asyncio

    def _infer():
        pipe = _get_qwen_pipeline()
        tokenizer = pipe.tokenizer

        # Use the model's built-in chat template if available
        if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
            prompt = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
        else:
            # Manual fallback for models without chat template
            parts = []
            for msg in messages:
                role = msg["role"].upper()
                content = msg["content"]
                parts.append(f"<|im_start|>{role}\n{content}<|im_end|>")
            parts.append("<|im_start|>assistant\n")
            prompt = "\n".join(parts)

        output = pipe(prompt, return_full_text=False)
        generated = output[0]["generated_text"] if output else ""

        # Strip any trailing special tokens or think-blocks (Qwen3 can emit <think>…</think>)
        if "<think>" in generated and "</think>" in generated:
            start = generated.rfind("</think>")
            generated = generated[start + len("</think>"):].strip()

        return generated.strip()

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _infer)


# ─── Full RAG pipeline ───────────────────────────────────────────────────────

async def generate_rag_response(
    query: str,
    org_id: str,
    chatbot_id: str,
    conversation_history: List[Dict],
    chatbot_config: Dict,
) -> Tuple[str, List[Dict], float]:
    """
    Full RAG pipeline.
    Returns: (response_text, source_docs, confidence_score)
    Structure identical to original — only the LLM backend changed.
    """
    # 1. Retrieve relevant chunks
    chunks = await retrieve_chunks(query, org_id, chatbot_id)

    # 2. Evaluate confidence
    best_score = chunks[0]["score"] if chunks else 0.0
    threshold = chatbot_config.get("confidence_threshold", 0.5)

    # 3. Insufficient context → escalate
    if not chunks or best_score < threshold:
        return (
            "I don't have enough information to answer that question accurately. "
            "Would you like me to connect you with a human support agent?",
            [],
            best_score,
        )

    # 4. Build context string (unchanged)
    context_parts = [
        f"[Source: {c['document_name']}]\n{c['text']}"
        for c in chunks
    ]
    context = "\n\n---\n\n".join(context_parts)

    # 5. Build messages list (unchanged structure)
    system_prompt = _build_system_prompt(
        personality=chatbot_config.get("personality", "You are a helpful AI assistant."),
        tone=chatbot_config.get("tone", "professional"),
        language=chatbot_config.get("language", "auto"),
        max_length=chatbot_config.get("max_response_length", 500),
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": f"KNOWLEDGE BASE CONTEXT:\n\n{context}"},
    ]

    # Add last N conversation turns for memory (unchanged)
    for turn in conversation_history[-10:]:
        messages.append({"role": turn["role"], "content": turn["content"]})

    # Add current user query (unchanged)
    messages.append({"role": "user", "content": query})

    # 6. Generate response — Qwen3 local inference (replaces OpenAI call)
    try:
        response_text = await _call_qwen(messages)
        if not response_text.strip():
            raise ValueError("Qwen returned an empty response")
    except Exception as e:
        logger.error(f"Qwen inference failed: {e}")
        # Graceful degradation — surface context snippet so the flow is not broken
        response_text = (
            f"I found relevant information but encountered an error generating the response. "
            f"Here is what I found: {chunks[0]['text'][:300]}..."
        )

    # 7. Format sources (unchanged)
    source_docs = [
        {
            "document_name": c["document_name"],
            "document_id": c["document_id"],
            "score": round(c["score"], 4),
        }
        for c in chunks[:3]
    ]

    return response_text, source_docs, best_score


# ─── Conversation history (unchanged) ────────────────────────────────────────

async def get_conversation_history(conversation_id: str) -> List[Dict]:
    """Fetch recent messages for a conversation (for LLM context)."""
    db = get_supabase()
    try:
        result = (
            db.table("messages")
            .select("role, content")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return list(reversed(result.data or []))
    except Exception as e:
        logger.error(f"Failed to fetch history for {conversation_id}: {e}")
        return []
