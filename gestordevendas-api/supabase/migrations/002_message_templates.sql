-- ============================================================================
-- Migration 002 — Message Templates (Fase 2, Task 1)
-- Executar no SQL Editor do Supabase (ou via supabase db push)
-- ============================================================================

-- ============================================================================
-- MESSAGE TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    content         TEXT NOT NULL,
    -- Conteúdo com {{variáveis}}: {{name}}, {{company}}, {{date}}
    category        TEXT DEFAULT 'general',
    -- Tipo de template: general, greeting, closing, support, etc.
    media_url       TEXT,
    -- URL de mídia associada (imagem, vídeo)
    usage_count     INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, name)
);

CREATE INDEX IF NOT EXISTS templates_account_id_idx ON message_templates(account_id);
CREATE INDEX IF NOT EXISTS templates_category_idx ON message_templates(account_id, category) WHERE is_active = TRUE;

CREATE TRIGGER message_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON message_templates FOR ALL TO service_role USING (true);

-- ============================================================================
-- Sucesso: tabela pronta para usar
-- ============================================================================
