-- ============================================================
-- RAG ChatBot — Supabase Database Schema
-- Safe to re-run — uses IF NOT EXISTS and DROP POLICY IF EXISTS
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Organizations ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Organization Members ────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- ─── Chatbots ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chatbots (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    personality             TEXT NOT NULL DEFAULT 'You are a helpful AI assistant.',
    welcome_message         TEXT NOT NULL DEFAULT 'Hello! How can I help you today?',
    language                TEXT NOT NULL DEFAULT 'auto',
    tone                    TEXT NOT NULL DEFAULT 'professional',
    response_mode           TEXT NOT NULL DEFAULT 'text'
                                CHECK (response_mode IN ('text','audio','text_to_audio','audio_to_audio')),
    max_response_length     INTEGER NOT NULL DEFAULT 500,
    human_support_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    confidence_threshold    FLOAT NOT NULL DEFAULT 0.5,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── WhatsApp Connections ────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatbot_id      UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id      TEXT NOT NULL,
    api_key         TEXT NOT NULL,
    phone_number    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'disconnected'
                        CHECK (status IN ('connected','disconnected','pending')),
    webhook_url     TEXT,
    webhook_secret  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Documents ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chatbot_id      UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_type       TEXT NOT NULL,
    file_size       BIGINT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','indexed','error')),
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Conversations ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chatbot_id      UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
    user_phone      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','human_takeover','resolved')),
    message_count   INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_org_id       ON conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_phone   ON conversations(user_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- ─── Messages ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role                TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content             TEXT NOT NULL,
    message_type        TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','audio')),
    source_documents    JSONB,
    confidence_score    FLOAT,
    wa_message_id       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_id          ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at DESC);

-- ─── Support Requests ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_phone          TEXT NOT NULL,
    reason              TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','resolved')),
    admin_notes         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Feedback ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id          UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rating              TEXT NOT NULL CHECK (rating IN ('positive','negative')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Analytics Events ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chatbot_id  UUID REFERENCES chatbots(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org     ON analytics_events(org_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type    ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);

-- ─── Row Level Security ──────────────────────────────────────

ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbots               ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback               ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events       ENABLE ROW LEVEL SECURITY;

-- ─── Helper Function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── Drop existing policies (safe re-run) ────────────────────

DROP POLICY IF EXISTS "org_members_own"                ON organization_members;
DROP POLICY IF EXISTS "org_own"                        ON organizations;
DROP POLICY IF EXISTS "chatbots_own_org"               ON chatbots;
DROP POLICY IF EXISTS "whatsapp_connections_own_org"   ON whatsapp_connections;
DROP POLICY IF EXISTS "documents_own_org"              ON documents;
DROP POLICY IF EXISTS "conversations_own_org"          ON conversations;
DROP POLICY IF EXISTS "messages_own_org"               ON messages;
DROP POLICY IF EXISTS "support_requests_own_org"       ON support_requests;
DROP POLICY IF EXISTS "feedback_own_org"               ON feedback;
DROP POLICY IF EXISTS "analytics_events_own_org"       ON analytics_events;
DROP POLICY IF EXISTS "documents_upload_own_org"       ON storage.objects;
DROP POLICY IF EXISTS "documents_read_own_org"         ON storage.objects;
DROP POLICY IF EXISTS "audio_public_read"              ON storage.objects;

-- ─── RLS Policies ────────────────────────────────────────────

CREATE POLICY "org_members_own" ON organization_members
    USING (user_id = auth.uid());

CREATE POLICY "org_own" ON organizations
    USING (id = get_my_org_id());

CREATE POLICY "chatbots_own_org" ON chatbots
    USING (org_id = get_my_org_id());

CREATE POLICY "whatsapp_connections_own_org" ON whatsapp_connections
    USING (org_id = get_my_org_id());

CREATE POLICY "documents_own_org" ON documents
    USING (org_id = get_my_org_id());

CREATE POLICY "conversations_own_org" ON conversations
    USING (org_id = get_my_org_id());

CREATE POLICY "messages_own_org" ON messages
    USING (org_id = get_my_org_id());

CREATE POLICY "support_requests_own_org" ON support_requests
    USING (org_id = get_my_org_id());

CREATE POLICY "feedback_own_org" ON feedback
    USING (org_id = get_my_org_id());

CREATE POLICY "analytics_events_own_org" ON analytics_events
    USING (org_id = get_my_org_id());

-- ─── Storage Buckets ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
    ('documents',       'documents',       false, 10485760),
    ('audio-responses', 'audio-responses', true,  5242880)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS Policies ────────────────────────────────────

CREATE POLICY "documents_upload_own_org" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = get_my_org_id()::text
    );

CREATE POLICY "documents_read_own_org" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = get_my_org_id()::text
    );

CREATE POLICY "audio_public_read" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'audio-responses');
