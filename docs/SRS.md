# Software Requirements Specification (SRS)
# AI-Powered WhatsApp Chatbot Using RAG

**Version:** 1.0  
**Date:** October 2026  

---

## 1. Introduction

### 1.1 Purpose
This document defines requirements for an AI-powered WhatsApp chatbot that uses Retrieval-Augmented Generation (RAG) to answer questions from uploaded organizational knowledge bases.

### 1.2 Scope
A full-stack SaaS application enabling organizations to deploy intelligent WhatsApp chatbots backed by their own documents. Administrators upload content; end users interact through WhatsApp.

### 1.3 Definitions
- **RAG** — Retrieval-Augmented Generation: AI pattern combining document retrieval with generative AI.
- **Embedding** — Numerical vector representation of text for semantic search.
- **Chunk** — A segment of a document stored and indexed for retrieval.
- **WasenderAPI** — Third-party WhatsApp API gateway used for message delivery.
- **Pinecone** — Vector database for storing and querying embeddings.
- **Supabase** — Backend-as-a-service providing PostgreSQL, Auth, and Storage.

---

## 2. System Overview

The system consists of:
- React/TypeScript frontend (admin dashboard + user chat access page)
- Python/FastAPI backend (RAG pipeline, WhatsApp webhook, API)
- Supabase (relational data, authentication, file storage)
- Pinecone (vector embeddings)
- WasenderAPI (WhatsApp messaging)
- OpenAI / Hugging Face (AI models)

---

## 3. Functional Requirements

### 3.1 Authentication
- FR-AUTH-01: Administrators register with email and password via Supabase Auth.
- FR-AUTH-02: Login returns a JWT used for API authorization.
- FR-AUTH-03: Role-based access control differentiates admin from regular users.
- FR-AUTH-04: All admin routes require valid JWT.
- FR-AUTH-05: Row Level Security (RLS) enforces data isolation per organization.

### 3.2 Chatbot Management
- FR-BOT-01: Admins create, update, and delete chatbot configurations.
- FR-BOT-02: Each chatbot has name, personality, language, and response mode.
- FR-BOT-03: Chatbots are scoped to an organization.
- FR-BOT-04: Admins connect a WhatsApp session via WasenderAPI API key.

### 3.3 Knowledge Base
- FR-KB-01: Admins upload PDF, DOCX, and TXT documents.
- FR-KB-02: Files are stored in Supabase Storage.
- FR-KB-03: Backend extracts text, chunks it, and generates embeddings.
- FR-KB-04: Embeddings are stored in Pinecone with metadata (org_id, bot_id, doc_id).
- FR-KB-05: Admins can delete documents and their associated embeddings.
- FR-KB-06: Admins can view document processing status.

### 3.4 RAG Pipeline
- FR-RAG-01: Incoming WhatsApp message triggers embedding generation for the query.
- FR-RAG-02: Pinecone returns top-k relevant chunks filtered by org_id + bot_id.
- FR-RAG-03: Retrieved chunks and conversation history are passed to the LLM.
- FR-RAG-04: If similarity score is below threshold, trigger human escalation.
- FR-RAG-05: LLM response includes source document references.

### 3.5 WhatsApp Integration
- FR-WA-01: WasenderAPI webhook receives incoming messages.
- FR-WA-02: Webhook verifies X-Webhook-Signature header.
- FR-WA-03: Backend processes text messages through RAG pipeline.
- FR-WA-04: Backend processes audio messages via speech-to-text.
- FR-WA-05: Responses are sent via WasenderAPI REST API.
- FR-WA-06: Audio responses are generated via text-to-speech and sent as audio.

### 3.6 Voice and Multilingual
- FR-VOICE-01: Audio messages are transcribed using Whisper (OpenAI or local).
- FR-VOICE-02: Text responses can be converted to audio via TTS.
- FR-VOICE-03: Language detection is applied to incoming messages.
- FR-VOICE-04: Responses are generated in the detected or preferred language.

### 3.7 Conversation Memory
- FR-MEM-01: Last N messages per user session are stored in Supabase.
- FR-MEM-02: Conversation history is included in LLM context window.
- FR-MEM-03: Sessions expire after configurable inactivity period.

### 3.8 Human Escalation
- FR-ESC-01: When confidence is low, bot informs user and creates support request.
- FR-ESC-02: Admin receives notification of pending support request.
- FR-ESC-03: Admin can send manual replies through the dashboard.
- FR-ESC-04: Bot pauses AI responses during human takeover.
- FR-ESC-05: Admin marks support complete to resume AI responses.

### 3.9 Feedback
- FR-FB-01: Bot sends feedback prompt after responses.
- FR-FB-02: User replies "1" (helpful) or "2" (not helpful).
- FR-FB-03: Feedback stored in Supabase and shown in analytics.

### 3.10 Analytics
- FR-AN-01: Dashboard shows total messages, active conversations, answered/unanswered.
- FR-AN-02: Charts show daily message volume and weekly trends.
- FR-AN-03: Top frequently asked questions are displayed.
- FR-AN-04: Human support request counts are tracked.

---

## 4. Non-Functional Requirements

- NFR-01: API response time under 3 seconds for text, 10 seconds for audio.
- NFR-02: All API keys stored as environment variables, never in source code.
- NFR-03: HTTPS required for all webhook endpoints.
- NFR-04: Rate limiting on webhook endpoint (100 req/min).
- NFR-05: File upload limited to 10MB per document.
- NFR-06: Row Level Security enforced on all Supabase tables.
- NFR-07: Input validation on all API endpoints.

---

## 5. Free-Tier Limitations

| Service | Free Tier | Limitation |
|---------|-----------|-----------|
| Pinecone | 2GB storage, ~300k vectors, 2M write units/month | Sufficient for demo |
| Supabase | 500MB DB, 1GB storage, 50k auth users | Sufficient for demo |
| OpenAI | No free tier — requires API key with pay-per-use | ~$0.002/1k tokens (GPT-3.5-turbo) |
| Hugging Face Inference API | Free tier with rate limits | Alternative to OpenAI |
| WasenderAPI | **$6/month minimum** — no free tier confirmed | Paid; required for real WhatsApp |
| Vercel | Free Hobby plan | Sufficient for frontend |
| Render / Railway | Free tier for Python backend | Sufficient for demo |

### WasenderAPI Cost Clarification
WasenderAPI starts at **$6/month** for one WhatsApp number with unlimited messages. There is no confirmed free plan for production use. For development and demonstration purposes, all backend logic can be built and tested with mock webhook payloads. The system is designed to plug in real WasenderAPI credentials when available.

---

## 6. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                         │
│                    React + TypeScript + Vite                     │
│  Landing | Login | Dashboard | KB | Analytics | Support | Config │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS REST + Supabase Client
┌──────────────────────────▼──────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
│  /auth  /chatbot  /documents  /webhook  /messages  /analytics   │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ RAG Service │  │ Voice Service│  │  WhatsApp Service      │ │
│  │ Embeddings  │  │ STT / TTS    │  │  WasenderAPI Client    │ │
│  │ Retrieval   │  │ Whisper      │  │  Webhook Handler       │ │
│  └──────┬──────┘  └──────────────┘  └────────────────────────┘ │
└─────────┼───────────────────────────────────────────────────────┘
          │
┌─────────▼──────────┐    ┌──────────────────┐    ┌─────────────┐
│    Supabase        │    │    Pinecone       │    │  OpenAI /   │
│  PostgreSQL + Auth │    │  Vector Store     │    │  HuggingFace│
│  Storage           │    │  Embeddings       │    │  Models     │
└────────────────────┘    └──────────────────┘    └─────────────┘
          ▲
┌─────────┴──────────┐
│   WasenderAPI      │
│  WhatsApp Gateway  │
│  Webhooks → Backend│
└────────────────────┘
```
