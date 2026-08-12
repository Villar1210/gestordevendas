-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,

    -- Events this webhook subscribes to
    events TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Security
    secret VARCHAR(255) NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,

    -- Retry configuration
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,

    -- Metadata
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhook logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,

    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,

    -- Response information
    status_code INTEGER,
    response_body TEXT,

    -- Retry information
    attempt_number INTEGER DEFAULT 1,
    next_retry_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed, timeout
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_account_id ON webhooks(account_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- Create triggers
CREATE OR REPLACE TRIGGER webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_role_only_webhooks" ON webhooks FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_webhook_logs" ON webhook_logs FOR ALL TO service_role USING (true);
