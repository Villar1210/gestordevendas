-- Create metrics table for KPIs and analytics
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'kpi', 'trend', 'team'
    metric_name VARCHAR(100) NOT NULL, -- 'total_leads', 'conversion_rate', etc
    metric_value FLOAT NOT NULL,
    dimensions JSONB, -- JSON with dimensions like {date, user_id, category}
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analytics events table for tracking user actions
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID,
    event_type VARCHAR(100) NOT NULL, -- 'card_created', 'card_won', 'message_sent', etc
    event_value FLOAT DEFAULT 1,
    metadata JSONB, -- Additional context: {card_id, pipeline_id, etc}
    event_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily summary table for fast aggregations
CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    total_leads INTEGER DEFAULT 0,
    total_won INTEGER DEFAULT 0,
    total_revenue FLOAT DEFAULT 0,
    conversion_rate FLOAT DEFAULT 0,
    avg_deal_size FLOAT DEFAULT 0,
    team_size INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, summary_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_metrics_account_type ON metrics(account_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_period ON metrics(account_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_events_account ON analytics_events(account_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(account_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_date ON analytics_events(account_id, event_date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(account_id, summary_date);

-- Create triggers for updated_at
CREATE OR REPLACE TRIGGER metrics_updated_at
    BEFORE UPDATE ON metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER daily_summaries_updated_at
    BEFORE UPDATE ON daily_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Create RPC function to calculate KPIs
CREATE OR REPLACE FUNCTION calculate_kpis(p_account_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    metric_name VARCHAR,
    metric_value FLOAT,
    previous_value FLOAT,
    change_percent FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'total_leads'::VARCHAR,
        COALESCE(SUM(CASE WHEN event_type = 'card_created' THEN 1 ELSE 0 END), 0)::FLOAT,
        COALESCE((SELECT SUM(CASE WHEN event_type = 'card_created' THEN 1 ELSE 0 END)
            FROM analytics_events
            WHERE account_id = p_account_id
            AND event_date::DATE < p_start_date
            AND event_date::DATE >= (p_start_date - INTERVAL '30 days')), 0)::FLOAT,
        CASE
            WHEN COALESCE((SELECT SUM(CASE WHEN event_type = 'card_created' THEN 1 ELSE 0 END)
                FROM analytics_events
                WHERE account_id = p_account_id
                AND event_date::DATE < p_start_date
                AND event_date::DATE >= (p_start_date - INTERVAL '30 days')), 0) = 0
            THEN 0
            ELSE ((COALESCE(SUM(CASE WHEN event_type = 'card_created' THEN 1 ELSE 0 END), 0) -
                COALESCE((SELECT SUM(CASE WHEN event_type = 'card_created' THEN 1 ELSE 0 END)
                    FROM analytics_events
                    WHERE account_id = p_account_id
                    AND event_date::DATE < p_start_date
                    AND event_date::DATE >= (p_start_date - INTERVAL '30 days')), 0)) /
                COALESCE((SELECT SUM(CASE WHEN event_type = 'card_created' THEN 1 ELSE 0 END)
                    FROM analytics_events
                    WHERE account_id = p_account_id
                    AND event_date::DATE < p_start_date
                    AND event_date::DATE >= (p_start_date - INTERVAL '30 days')), 1)) * 100
        END
    FROM analytics_events
    WHERE account_id = p_account_id
    AND event_date::DATE >= p_start_date
    AND event_date::DATE <= p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_role_only_metrics" ON metrics FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_analytics_events" ON analytics_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_daily_summaries" ON daily_summaries FOR ALL TO service_role USING (true);
