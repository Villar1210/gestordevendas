-- Create tenant settings table
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,

    -- General settings
    company_name VARCHAR(255),
    company_logo_url TEXT,
    theme VARCHAR(50) DEFAULT 'light', -- light, dark, auto
    language VARCHAR(10) DEFAULT 'pt-BR', -- pt-BR, en-US, es-ES
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',

    -- Feature flags
    enable_whatsapp BOOLEAN DEFAULT TRUE,
    enable_email BOOLEAN DEFAULT TRUE,
    enable_sms BOOLEAN DEFAULT FALSE,
    enable_analytics BOOLEAN DEFAULT TRUE,
    enable_ai BOOLEAN DEFAULT FALSE,

    -- Quota settings
    max_users INTEGER DEFAULT 10,
    max_contacts INTEGER DEFAULT 1000,
    max_storage_gb INTEGER DEFAULT 5,

    -- Notification settings
    notify_new_lead BOOLEAN DEFAULT TRUE,
    notify_deal_won BOOLEAN DEFAULT TRUE,
    notify_team_activity BOOLEAN DEFAULT FALSE,

    -- Security settings
    require_2fa BOOLEAN DEFAULT FALSE,
    api_key_rotation_days INTEGER DEFAULT 90,
    session_timeout_minutes INTEGER DEFAULT 60,

    -- Integration settings
    integrations JSONB DEFAULT '{}', -- {stripe: {enabled, key}, zapier: {enabled, key}}
    webhooks JSONB DEFAULT '{}', -- Array of webhook configurations

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_settings_account_id ON tenant_settings(account_id);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER tenant_settings_updated_at
    BEFORE UPDATE ON tenant_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_role_only_settings" ON tenant_settings FOR ALL TO service_role USING (true);
