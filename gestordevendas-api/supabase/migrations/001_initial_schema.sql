-- ============================================================================
-- Migration 001 — Schema inicial do Gestor de Vendas CRM
-- Executar no SQL Editor do Supabase (ou via supabase db push)
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pgvector: necessário para embeddings da knowledge base (Fase 5)
-- Habilitar em: Supabase Dashboard -> Database -> Extensions -> vector
-- CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================================
-- ACCOUNTS (tenants do sistema multi-tenant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    -- Billing
    plan            TEXT NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'pro', 'enterprise')),
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    subscription_status     TEXT DEFAULT 'active'
                            CHECK (subscription_status IN
                                   ('active','trialing','past_due','canceled','unpaid')),
    trial_ends_at   TIMESTAMPTZ,
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- PROFILES (usuários do dashboard — espelha auth.users do Supabase)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    full_name   TEXT,
    avatar_url  TEXT,
    role        TEXT NOT NULL DEFAULT 'agent'
                CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_account_id_idx ON profiles(account_id);

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- CONTACTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    email       TEXT,
    tags        JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, phone)
);

CREATE INDEX IF NOT EXISTS contacts_account_id_idx ON contacts(account_id);
CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts(account_id, phone);

CREATE TRIGGER contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- INBOXES (contas WhatsApp conectadas via Meta Cloud API)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inboxes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    phone_number_id     TEXT NOT NULL,
    wa_business_id      TEXT,
    encrypted_access_token TEXT NOT NULL,   -- AES-256-GCM via Fernet, NUNCA expor
    webhook_verified    BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS inboxes_account_id_idx ON inboxes(account_id);
CREATE INDEX IF NOT EXISTS inboxes_phone_number_id_idx ON inboxes(phone_number_id);

CREATE TRIGGER inboxes_updated_at
    BEFORE UPDATE ON inboxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    inbox_id        UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    assignee_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'resolved', 'pending')),
    wa_conversation_id TEXT,
    ai_enabled      BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_account_id_idx ON conversations(account_id);
CREATE INDEX IF NOT EXISTS conversations_contact_id_idx ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS conversations_status_idx ON conversations(account_id, status);
CREATE INDEX IF NOT EXISTS conversations_last_message_idx ON conversations(account_id, last_message_at DESC);

CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    content         TEXT,
    message_type    TEXT NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text','image','audio','video','document','location','template','interactive')),
    direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','delivered','read','failed')),
    wa_message_id   TEXT,
    media_url       TEXT,
    sent_by_ai      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_wa_message_id_idx ON messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_account_id_idx ON messages(account_id);

CREATE TRIGGER messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- AUTOMATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS automations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    event       TEXT NOT NULL,   -- conversation_created, message_received, etc.
    conditions  JSONB DEFAULT '[]',
    actions     JSONB DEFAULT '[]',
    is_active   BOOLEAN DEFAULT TRUE,
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automations_account_event_idx ON automations(account_id, event) WHERE is_active = TRUE;

CREATE TRIGGER automations_updated_at
    BEFORE UPDATE ON automations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS automation_executions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    status          TEXT NOT NULL CHECK (status IN ('success','partial','error')),
    results         JSONB DEFAULT '[]',
    executed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_executions_automation_id_idx ON automation_executions(automation_id, executed_at DESC);


-- ============================================================================
-- BROADCASTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS broadcasts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    inbox_id            UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    template_name       TEXT NOT NULL,
    template_params     JSONB DEFAULT '[]',
    language_code       TEXT NOT NULL DEFAULT 'pt_BR',
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','scheduled','running','completed','cancelled','failed')),
    total_recipients    INTEGER DEFAULT 0,
    sent_count          INTEGER DEFAULT 0,
    delivered_count     INTEGER DEFAULT 0,
    failed_count        INTEGER DEFAULT 0,
    scheduled_at        TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS broadcasts_account_id_idx ON broadcasts(account_id, created_at DESC);

CREATE TRIGGER broadcasts_updated_at
    BEFORE UPDATE ON broadcasts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_id    UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','delivered','read','failed')),
    wa_message_id   TEXT,
    error_code      TEXT,
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS broadcast_recipients_broadcast_status_idx ON broadcast_recipients(broadcast_id, status);


-- ============================================================================
-- AI CONFIG (chaves criptografadas por account)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_configs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider            TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
    encrypted_api_key   TEXT NOT NULL,   -- AES-256-GCM via Fernet, NUNCA expor
    model               TEXT,
    max_tokens          INTEGER DEFAULT 1024,
    temperature         FLOAT DEFAULT 0.7,
    system_prompt       TEXT,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, provider)
);

CREATE TRIGGER ai_configs_updated_at
    BEFORE UPDATE ON ai_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- KNOWLEDGE BASE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_knowledge_entries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    -- embedding vector(1536),  -- descomente após habilitar extensão pgvector
    category    TEXT,
    tags        JSONB DEFAULT '[]',
    is_active   BOOLEAN DEFAULT TRUE,
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kb_entries_account_id_idx ON ai_knowledge_entries(account_id) WHERE is_active = TRUE;

CREATE TRIGGER kb_entries_updated_at
    BEFORE UPDATE ON ai_knowledge_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função RPC para busca vetorial (ativar após habilitar pgvector):
-- CREATE OR REPLACE FUNCTION match_knowledge_entries(
--     query_embedding vector(1536),
--     match_account_id UUID,
--     match_threshold FLOAT DEFAULT 0.3,
--     match_count INT DEFAULT 5
-- )
-- RETURNS TABLE (id UUID, title TEXT, content TEXT, similarity FLOAT)
-- LANGUAGE plpgsql AS $$
-- BEGIN
--   RETURN QUERY
--   SELECT e.id, e.title, e.content,
--          1 - (e.embedding <=> query_embedding) AS similarity
--   FROM ai_knowledge_entries e
--   WHERE e.account_id = match_account_id
--     AND e.is_active = TRUE
--     AND 1 - (e.embedding <=> query_embedding) > (1 - match_threshold)
--   ORDER BY e.embedding <=> query_embedding
--   LIMIT match_count;
-- END;
-- $$;


-- ============================================================================
-- CHATBOT FLOWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS chatbot_flows (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    description         TEXT,
    trigger_keywords    JSONB DEFAULT '[]',   -- ["oi", "olá", "começar"]
    nodes               JSONB DEFAULT '[]',   -- array de nós do flow
    is_active           BOOLEAN DEFAULT TRUE,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flows_account_id_idx ON chatbot_flows(account_id) WHERE is_active = TRUE;

CREATE TRIGGER flows_updated_at
    BEFORE UPDATE ON chatbot_flows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS flow_runs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    flow_id             UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    current_node_index  INTEGER DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'completed', 'expired', 'error')),
    error_reason        TEXT,
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flow_runs_conversation_idx ON flow_runs(conversation_id, status);
CREATE INDEX IF NOT EXISTS flow_runs_running_idx ON flow_runs(status, updated_at) WHERE status = 'running';

CREATE TRIGGER flow_runs_updated_at
    BEFORE UPDATE ON flow_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- USAGE COUNTERS (contagens mensais para enforcement de quotas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_counters (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period                  TEXT NOT NULL,   -- formato: YYYY-MM
    conversations_count     INTEGER DEFAULT 0,
    broadcasts_count        INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, period)
);

CREATE TRIGGER usage_counters_updated_at
    BEFORE UPDATE ON usage_counters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Habilitar RLS em todas as tabelas.
-- As políticas permitem acesso apenas via service_role (backend).
-- O backend SEMPRE filtra por account_id — RLS é a segunda camada.
-- ============================================================================

ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inboxes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_flows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters        ENABLE ROW LEVEL SECURITY;

-- Política: apenas service_role tem acesso total (o backend usa service_role key)
-- Isso bloqueia acesso direto via anon key ou JWT de usuários finais
CREATE POLICY "service_role_only" ON accounts              FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON profiles              FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON contacts              FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON inboxes               FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON conversations         FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON messages              FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON automations           FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON automation_executions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON broadcasts            FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON broadcast_recipients  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON ai_configs            FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON ai_knowledge_entries  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON chatbot_flows         FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON flow_runs             FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only" ON usage_counters        FOR ALL TO service_role USING (true);
