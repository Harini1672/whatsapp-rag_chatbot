from pydantic import BaseModel, Field
from typing import Optional, List, Any
from enum import Enum


class ResponseMode(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    TEXT_TO_AUDIO = "text_to_audio"
    AUDIO_TO_AUDIO = "audio_to_audio"


class ChatbotTone(str, Enum):
    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"
    EDUCATIONAL = "educational"
    CUSTOMER_SUPPORT = "customer_support"


# ─── Auth ────────────────────────────────────────────────────

class TokenData(BaseModel):
    user_id: str
    org_id: Optional[str] = None
    role: str = "admin"


# ─── Chatbot ─────────────────────────────────────────────────

class ChatbotCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    personality: str = Field(min_length=10)
    welcome_message: str = Field(min_length=5)
    language: str = "auto"
    tone: ChatbotTone = ChatbotTone.PROFESSIONAL
    response_mode: ResponseMode = ResponseMode.TEXT
    max_response_length: int = Field(default=500, ge=50, le=2000)
    human_support_enabled: bool = True
    confidence_threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class ChatbotUpdate(ChatbotCreate):
    pass


# ─── WhatsApp ────────────────────────────────────────────────

class WhatsAppConnectRequest(BaseModel):
    session_id: str
    api_key: str
    phone_number: str
    chatbot_id: str


# ─── Documents ───────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: str
    name: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    error_message: Optional[str]
    created_at: str


# ─── Knowledge Base ──────────────────────────────────────────

class KBSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    chatbot_id: str
    top_k: int = Field(default=5, ge=1, le=20)


class KBSearchResult(BaseModel):
    document_name: str
    chunk_text: str
    score: float
    document_id: str


# ─── WhatsApp Webhook ────────────────────────────────────────

class WasenderWebhookPayload(BaseModel):
    event: Optional[str] = None
    data: Optional[dict] = None


# ─── Conversations ───────────────────────────────────────────

class AdminReplyRequest(BaseModel):
    message: str
    user_phone: str


# ─── Support ─────────────────────────────────────────────────

class SupportStatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None


# ─── Analytics ───────────────────────────────────────────────

class DailyCount(BaseModel):
    date: str
    count: int


class TopQuestion(BaseModel):
    question: str
    count: int


class AnalyticsSummary(BaseModel):
    total_messages: int = 0
    total_conversations: int = 0
    active_conversations: int = 0
    answered_questions: int = 0
    unanswered_questions: int = 0
    support_requests: int = 0
    positive_feedback: int = 0
    negative_feedback: int = 0
    daily_messages: List[DailyCount] = []
    top_questions: List[TopQuestion] = []


class DashboardData(BaseModel):
    stats: Any
    daily_messages: List[DailyCount] = []
    top_questions: List[TopQuestion] = []
    recent_conversations: List[Any] = []
    whatsapp_connected: bool = False
