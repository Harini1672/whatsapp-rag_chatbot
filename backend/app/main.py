"""
RAG ChatBot — FastAPI Backend
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import chatbots, documents, whatsapp, conversations, knowledge_base, analytics, support

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered WhatsApp Chatbot using RAG — FastAPI Backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ─── CORS ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://whatsapp-rag-chatbot-backend.onrender.com",
        "https://whatsapp-rag-chatbot.vercel.app",
        # Wildcard for all Vercel preview deployments
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────
PREFIX = "/api"
app.include_router(chatbots.router, prefix=PREFIX)
app.include_router(documents.router, prefix=PREFIX)
app.include_router(whatsapp.router, prefix=PREFIX)
app.include_router(conversations.router, prefix=PREFIX)
app.include_router(knowledge_base.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(support.router, prefix=PREFIX)

# ─── Health ──────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/")
async def root():
    return JSONResponse({
        "name": "RAG ChatBot API",
        "docs": "/api/docs",
        "health": "/api/health",
    })


# ─── Startup ─────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    logger.info(f"Starting {settings.APP_NAME}")
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — AI features will use mock mode")
    if not settings.PINECONE_API_KEY:
        logger.warning("PINECONE_API_KEY not set — vector search disabled")
