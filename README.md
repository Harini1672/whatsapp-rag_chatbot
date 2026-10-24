# AI-Powered WhatsApp Chatbot — RAG System

A complete, production-ready full-stack application that deploys an intelligent WhatsApp chatbot grounded in your own uploaded documents using Retrieval-Augmented Generation (RAG).

---

## What It Does

1. An administrator uploads PDF/DOCX/TXT documents (FAQ, policy, product guide, etc.)
2. The system extracts text, chunks it, generates vector embeddings, and stores them in Pinecone
3. When a user messages the connected WhatsApp number, the backend retrieves the most relevant document chunks and generates a grounded AI response
4. The response is sent back to the user via WhatsApp — with full conversation memory, voice support, multilingual detection, and human escalation

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Python 3.11 + FastAPI |
| Database + Auth | Supabase (PostgreSQL + Auth + Storage) |
| Vector Store | Pinecone (serverless free tier) |
| AI / LLM | OpenAI GPT-4o-mini + text-embedding-3-small |
| Speech | OpenAI Whisper (STT) + TTS-1 |
| WhatsApp | WasenderAPI |
| Frontend Deploy | Vercel |
| Backend Deploy | Render (free tier) |

---

## Free-Tier Cost Summary

| Service | Free Tier | Notes |
|---|---|---|
| Supabase | 500MB DB, 1GB Storage, 50k users | Sufficient for demo |
| Pinecone | 2GB / ~300k vectors | Sufficient for demo |
| Vercel | Unlimited hobby deployments | Free |
| Render | 750 hrs/month (spins down on idle) | Free |
| OpenAI | **Pay-per-use** — no free tier | ~$0.002/1k tokens (GPT-3.5), ~$0.15/1k (GPT-4o-mini) |
| **WasenderAPI** | **$6/month minimum** — no free tier | Required for real WhatsApp |

> **Important:** WasenderAPI requires a paid plan ($6/month) to send and receive real WhatsApp messages. All backend logic, RAG pipeline, and dashboard features work without it during development — you can test the full flow using the mock webhook endpoint.

---

## Project Structure

```
Whatapp Bot/
├── frontend/                   # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/           # ProtectedRoute
│   │   │   ├── layout/         # AdminLayout, Sidebar, TopBar
│   │   │   └── ui/             # Button, Card, Input, Badge, Modal, ...
│   │   ├── contexts/           # AuthContext, ThemeContext
│   │   ├── lib/                # supabase.ts, api.ts, utils.ts
│   │   ├── pages/
│   │   │   ├── auth/           # LoginPage, RegisterPage
│   │   │   ├── dashboard/      # DashboardPage
│   │   │   ├── chatbot/        # ChatbotPage
│   │   │   ├── whatsapp/       # WhatsAppPage
│   │   │   ├── documents/      # DocumentsPage
│   │   │   ├── knowledge/      # KnowledgeBasePage
│   │   │   ├── conversations/  # ConversationsPage
│   │   │   ├── analytics/      # AnalyticsPage
│   │   │   ├── support/        # SupportPage
│   │   │   ├── qrcode/         # QRCodePage
│   │   │   ├── settings/       # SettingsPage
│   │   │   └── chat/           # ChatAccessPage (user-facing)
│   │   └── types/              # TypeScript types + Supabase schema
│   ├── .env.example
│   └── vercel.json
│
├── backend/                    # Python + FastAPI
│   ├── app/
│   │   ├── main.py             # FastAPI app entry point
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   ├── database.py         # Supabase client
│   │   ├── auth.py             # JWT verification
│   │   ├── models.py           # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── chatbots.py     # CRUD for chatbot configs
│   │   │   ├── documents.py    # Upload + reindex
│   │   │   ├── whatsapp.py     # Connect + webhook receiver
│   │   │   ├── conversations.py
│   │   │   ├── knowledge_base.py
│   │   │   ├── analytics.py
│   │   │   └── support.py
│   │   └── services/
│   │       ├── rag_service.py          # RAG pipeline (retrieve + generate)
│   │       ├── embedding_service.py    # OpenAI embeddings + Pinecone
│   │       ├── document_service.py     # Extract + chunk + index
│   │       ├── wasender_service.py     # WasenderAPI HTTP client
│   │       ├── voice_service.py        # Whisper STT + OpenAI TTS
│   │       └── message_processor.py   # Central webhook handler
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # Complete Supabase schema + RLS
│   ├── .env.example
│   ├── requirements.txt
│   ├── render.yaml
│   └── Procfile
│
└── docs/
    └── SRS.md                  # Software Requirements Specification
```

---

## Setup Guide

### Step 1 — Clone and configure

```bash
git clone <your-repo>
cd "Whatapp Bot"
```

### Step 2 — Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Open the SQL Editor and run `backend/migrations/001_initial_schema.sql`
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` (frontend)
   - **service_role** key → `SUPABASE_KEY` (backend — keep secret)
4. In **Authentication → Settings**, disable email confirmation for local dev (optional)

### Step 3 — Create Pinecone index

1. Create a free account at [pinecone.io](https://pinecone.io)
2. Create a new index:
   - Name: `rag-chatbot`
   - Dimensions: `1536`
   - Metric: `cosine`
   - Type: Serverless (AWS us-east-1)
3. Copy your API key → `PINECONE_API_KEY`

### Step 4 — Get OpenAI API key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key → `OPENAI_API_KEY`
3. Add a small credit balance (~$5 is enough for extensive testing)

### Step 5 — Configure backend

```bash
cd backend
cp .env.example .env
# Edit .env with your actual values
```

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=rag-chatbot
PINECONE_ENVIRONMENT=us-east-1
BACKEND_URL=http://localhost:8000
```

### Step 6 — Configure frontend

```bash
cd frontend
cp .env.example .env
# Edit .env
```

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8000/api
```

### Step 7 — Run the backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be at `http://localhost:8000/api`
Swagger docs at `http://localhost:8000/api/docs`

### Step 8 — Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be at `http://localhost:5173`

---

## WasenderAPI Setup (Required for real WhatsApp)

> **Cost:** WasenderAPI starts at **$6/month** for one WhatsApp number with unlimited messages. There is no confirmed free tier.

1. Create an account at [wasenderapi.com](https://wasenderapi.com)
2. Subscribe to a plan and create a WhatsApp session
3. Scan the QR code to connect your WhatsApp number
4. Copy your **Session ID** and **API Key**
5. In the admin dashboard → **WhatsApp** page, enter your credentials
6. Set your **Webhook URL** in the WasenderAPI dashboard:
   - Development: use [ngrok](https://ngrok.com) to expose `localhost:8000`
     ```bash
     ngrok http 8000
     # Webhook URL: https://xxxx.ngrok.io/api/whatsapp/webhook/{your-org-id}
     ```
   - Production: `https://your-backend.onrender.com/api/whatsapp/webhook/{your-org-id}`
7. Enable the **messages.upsert** webhook event in WasenderAPI dashboard

---

## Testing Without WasenderAPI

You can test the full RAG pipeline without spending money on WhatsApp:

### Test the webhook manually

```bash
curl -X POST http://localhost:8000/api/whatsapp/webhook/{your-org-id} \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "data": {
      "messages": {
        "key": {
          "id": "test-msg-001",
          "remoteJid": "919876543210@s.whatsapp.net",
          "cleanedSenderPn": "+919876543210",
          "fromMe": false
        },
        "messageBody": "What courses are available?",
        "message": {}
      }
    }
  }'
```

### Test semantic search

```bash
curl -X POST http://localhost:8000/api/knowledge-base/search \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "admission fee for B.Tech", "chatbot_id": "YOUR_BOT_ID", "top_k": 3}'
```

---

## Deployment

### Deploy Frontend to Vercel

```bash
cd frontend
npx vercel --prod
```

Set environment variables in the Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` → your Render backend URL

### Deploy Backend to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo, select the `backend/` directory
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add all environment variables from `.env.example`
7. Set `BACKEND_URL` to your Render URL (e.g. `https://rag-chatbot-backend.onrender.com`)

> **Note:** Render's free tier spins down after 15 minutes of inactivity. The first request after spin-down takes ~30 seconds. Use a paid instance for production.

### Update CORS after deployment

In `backend/app/main.py`, add your Vercel frontend URL to `allow_origins`:
```python
allow_origins=[
    "http://localhost:5173",
    "https://your-app.vercel.app",  # Add this
]
```

---

## Application Pages

| Route | Page | Description |
|---|---|---|
| `/` | Landing Page | Public marketing page |
| `/login` | Login | Admin sign in |
| `/register` | Register | Create org + admin account |
| `/chat` | Chat Access | User-facing WhatsApp link page |
| `/dashboard` | Dashboard | Stats, charts, recent activity |
| `/chatbot` | Chatbot Config | Create/edit AI assistant settings |
| `/whatsapp` | WhatsApp | Connect via WasenderAPI |
| `/documents` | Documents | Upload + manage knowledge base files |
| `/knowledge-base` | Knowledge Base | Semantic search test, reindex |
| `/conversations` | Conversations | View all WhatsApp threads |
| `/analytics` | Analytics | Charts and performance metrics |
| `/support` | Human Support | Manage escalation requests |
| `/qr-code` | QR Code | Generate shareable WhatsApp QR |
| `/settings` | Settings | Account, appearance, security |

---

## API Reference

Full Swagger docs available at `/api/docs` when backend is running.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/chatbots` | List chatbots |
| POST | `/api/chatbots` | Create chatbot |
| PUT | `/api/chatbots/{id}` | Update chatbot |
| DELETE | `/api/chatbots/{id}` | Delete chatbot |
| POST | `/api/documents/upload` | Upload + index document |
| GET | `/api/documents` | List documents |
| POST | `/api/documents/{id}/reindex` | Reindex a document |
| DELETE | `/api/documents/{id}` | Delete document + embeddings |
| POST | `/api/knowledge-base/search` | Semantic search |
| GET | `/api/knowledge-base/stats` | KB statistics |
| POST | `/api/knowledge-base/reindex-all/{bot_id}` | Reindex all |
| GET | `/api/whatsapp/status` | Connection status |
| POST | `/api/whatsapp/connect` | Save WasenderAPI credentials |
| POST | `/api/whatsapp/disconnect` | Disconnect |
| GET | `/api/whatsapp/webhook-url` | Get webhook URL |
| POST | `/api/whatsapp/webhook/{org_id}` | **Webhook receiver** |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/{id}/messages` | Get messages |
| POST | `/api/conversations/{id}/reply` | Admin manual reply |
| GET | `/api/analytics/dashboard` | Dashboard data |
| GET | `/api/analytics/summary` | Full analytics |
| GET | `/api/support` | List support requests |
| PATCH | `/api/support/{id}` | Update support status |
| POST | `/api/support/{id}/resolve` | Resolve + resume AI |

---

## Voice Communication Modes

| Mode | Input | Output | Config value |
|---|---|---|---|
| Text → Text | WhatsApp text | WhatsApp text | `text` |
| Audio → Text | Voice message | WhatsApp text | `audio` |
| Text → Audio | WhatsApp text | Voice message | `text_to_audio` |
| Audio → Audio | Voice message | Voice message | `audio_to_audio` |

Configure per-chatbot in the Chatbot Configuration page.

---

## Multilingual Support

The system supports automatic language detection and response:

- **English** (en)
- **Telugu** (te)
- **Hindi** (hi)
- More languages can be added via the chatbot language setting

Set chatbot language to `auto` to detect and respond in the user's language. Set to a specific language code to always respond in that language.

---

## Security Notes

- All admin API endpoints require a valid Supabase JWT (`Authorization: Bearer <token>`)
- Row Level Security (RLS) is enforced on all Supabase tables — each organization can only access its own data
- The backend uses the Supabase **service role key** which bypasses RLS — keep this key secret and never expose it in frontend code
- WasenderAPI keys are stored encrypted in the database, never in the frontend
- Webhook signature verification is implemented using HMAC-SHA256
- File uploads are validated by extension and capped at 10MB
- All environment variables must be set — the app will not start without Supabase credentials

---

## Troubleshooting

### "No text extracted" from PDF
Some PDFs are image-based (scanned). Use OCR tools like Adobe Acrobat to export as searchable PDF before uploading.

### Pinecone query returns empty results
- Verify `PINECONE_INDEX_NAME` matches the index you created
- Verify `PINECONE_ENVIRONMENT` matches your serverless region
- Ensure the document was successfully indexed (status = "indexed" in the Documents page)
- The `namespace` used is your `org_id` — ensure it matches what was used during upsert

### WasenderAPI webhook not receiving messages
- Your backend must be publicly accessible over HTTPS
- Use ngrok for local development: `ngrok http 8000`
- Verify the webhook URL in your WasenderAPI dashboard matches: `https://your-domain/api/whatsapp/webhook/{org_id}`
- Ensure the **messages.upsert** event is enabled in WasenderAPI

### "Invalid token" on API calls
- The frontend `VITE_SUPABASE_ANON_KEY` and backend `SUPABASE_ANON_KEY` must match
- In development mode, Supabase JWT verification uses the anon key — ensure it matches exactly

### Render backend spinning down
Render free tier spins down after 15 min idle. For demo purposes, use a [UptimeRobot](https://uptimerobot.com) free monitor to ping `/api/health` every 5 minutes to keep it alive.

---

## Example Workflow — Educational Institution

1. Admin registers, creates organization "ABC College"
2. Admin creates a chatbot "Admission Assistant" with professional tone
3. Admin uploads `admission_faq_2026.pdf` containing courses, fees, and procedures
4. Document is processed: 47 chunks indexed in Pinecone
5. Admin connects WhatsApp via WasenderAPI, sets webhook URL
6. Student sends: *"What is the B.Tech admission fee?"*
7. Backend receives webhook → embeds query → retrieves 5 relevant chunks from Pinecone → GPT-4o-mini generates response → WasenderAPI sends reply
8. Student receives: *"The B.Tech admission fee is ₹85,000 per year, including tuition and lab fees. Source: admission_faq_2026.pdf"*
9. Admin views the conversation in the dashboard with source references and confidence score

---

## License

MIT — free to use for personal and commercial projects.
