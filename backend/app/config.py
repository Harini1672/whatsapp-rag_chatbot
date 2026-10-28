from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "RAG ChatBot API"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str  # service role key (backend)
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""  # Project Settings → Data API → JWT Secret

    # OpenAI (optional — used only for TTS if available)
    OPENAI_API_KEY: str = ""

    # Pinecone
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "rag-chatbot-hf"
    PINECONE_ENVIRONMENT: str = "us-east-1"

    # WasenderAPI
    WASENDER_BASE_URL: str = "https://wasenderapi.com/api"

    # Backend public URL (used to construct webhook URL)
    BACKEND_URL: str = "http://localhost:8000"

    # Hugging Face — LLM
    LLM_MODEL: str = "Qwen/Qwen3-4B"
    LLM_FALLBACK_MODEL: str = "Qwen/Qwen3-1.7B"

    # Hugging Face — Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    EMBEDDING_DIMENSION: int = 384

    # Hugging Face — Speech-to-Text
    STT_MODEL: str = "openai/whisper-small"

    # RAG config (unchanged)
    MAX_TOKENS: int = 1000
    TOP_K_CHUNKS: int = 5
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 100

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
