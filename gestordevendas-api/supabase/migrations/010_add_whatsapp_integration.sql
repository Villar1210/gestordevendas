-- Create WhatsApp integrations table
CREATE TABLE IF NOT EXISTS whatsapp_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    business_account_id VARCHAR(255) NOT NULL,
    phone_number_id VARCHAR(255) NOT NULL,

    access_token VARCHAR(1000) NOT NULL,
    phone_number VARCHAR(20),

    is_active BOOLEAN DEFAULT true,

    webhook_url TEXT,
    webhook_secret VARCHAR(255),

    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create WhatsApp messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES whatsapp_integrations(id) ON DELETE CASCADE,

    message_id VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) NOT NULL,

    direction VARCHAR(10) NOT NULL, -- inbound, outbound
    message_type VARCHAR(20) NOT NULL, -- text, image, document, audio, video

    content TEXT,
    media_url TEXT,

    status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read, failed
    error_message TEXT,

    flow_session_id UUID, -- Se vem de um flow de chatbot

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create WhatsApp contacts table
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES whatsapp_integrations(id) ON DELETE CASCADE,

    phone_number VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    profile_picture_url TEXT,

    first_message_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_account_id
    ON whatsapp_integrations(account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_active
    ON whatsapp_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_account_id
    ON whatsapp_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_number
    ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at
    ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
    ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_account_id
    ON whatsapp_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone_number
    ON whatsapp_contacts(phone_number);

-- Create triggers
CREATE OR REPLACE TRIGGER whatsapp_integrations_updated_at
    BEFORE UPDATE ON whatsapp_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER whatsapp_messages_updated_at
    BEFORE UPDATE ON whatsapp_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER whatsapp_contacts_updated_at
    BEFORE UPDATE ON whatsapp_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_role_only_whatsapp_integrations" ON whatsapp_integrations
    FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_whatsapp_messages" ON whatsapp_messages
    FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_whatsapp_contacts" ON whatsapp_contacts
    FOR ALL TO service_role USING (true);
