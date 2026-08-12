-- Create chatbot flows table
CREATE TABLE IF NOT EXISTS chatbot_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    start_node_id UUID,

    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create flow nodes table
CREATE TABLE IF NOT EXISTS flow_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,

    node_type VARCHAR(20) NOT NULL, -- message, decision, action, ai_response, input

    title VARCHAR(255),
    description TEXT,

    config JSONB DEFAULT '{}',
    position JSONB DEFAULT '{}', -- {x, y}

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create flow edges table (connections between nodes)
CREATE TABLE IF NOT EXISTS flow_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,

    from_node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,

    condition JSONB DEFAULT '{}',
    label VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversation sessions table
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,

    phone_number VARCHAR(20),
    current_node_id UUID REFERENCES flow_nodes(id),

    context JSONB DEFAULT '{}',

    status VARCHAR(20) DEFAULT 'active', -- active, completed, abandoned

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_account_id ON chatbot_flows(account_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_active ON chatbot_flows(is_active);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow_id ON flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_edges_flow_id ON flow_edges(flow_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_account_id ON conversation_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_phone_number ON conversation_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_status ON conversation_sessions(status);

-- Create triggers
CREATE OR REPLACE TRIGGER chatbot_flows_updated_at
    BEFORE UPDATE ON chatbot_flows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER flow_nodes_updated_at
    BEFORE UPDATE ON flow_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER conversation_sessions_updated_at
    BEFORE UPDATE ON conversation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_role_only_chatbot_flows" ON chatbot_flows FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_flow_nodes" ON flow_nodes FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_flow_edges" ON flow_edges FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_conversation_sessions" ON conversation_sessions FOR ALL TO service_role USING (true);
