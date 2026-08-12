-- Create automations table
CREATE TABLE IF NOT EXISTS automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Trigger configuration
    trigger_type VARCHAR(50) NOT NULL,
    trigger_conditions JSONB DEFAULT '{}',

    -- Actions (array of action objects)
    actions JSONB[] DEFAULT ARRAY[]::JSONB[],

    -- Status
    active BOOLEAN DEFAULT true,

    -- Statistics
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create automation logs table
CREATE TABLE IF NOT EXISTS automation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,

    -- Event that triggered
    trigger_data JSONB NOT NULL,

    -- Actions executed
    executed_actions JSONB[] DEFAULT ARRAY[]::JSONB[],

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, success, partial, failed
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_automations_account_id ON automations(account_id);
CREATE INDEX IF NOT EXISTS idx_automations_active ON automations(active);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at DESC);

-- Create triggers
CREATE OR REPLACE TRIGGER automations_updated_at
    BEFORE UPDATE ON automations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_role_only_automations" ON automations FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_automation_logs" ON automation_logs FOR ALL TO service_role USING (true);
