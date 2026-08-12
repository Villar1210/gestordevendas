-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create embeddings table
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    content_chunk TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension
    chunk_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_account_id ON knowledge_base(account_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base(account_id, category);
CREATE INDEX IF NOT EXISTS idx_embeddings_account_id ON knowledge_embeddings(account_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_knowledge_id ON knowledge_embeddings(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create RPC function for vector similarity search
CREATE OR REPLACE FUNCTION search_knowledge_embeddings(
    p_account_id UUID,
    p_embedding vector(1536),
    p_limit INT DEFAULT 5,
    p_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    knowledge_id UUID,
    title VARCHAR,
    content TEXT,
    similarity FLOAT,
    category VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        (1 - (ke.embedding <=> p_embedding))::FLOAT as similarity,
        kb.category
    FROM knowledge_embeddings ke
    JOIN knowledge_base kb ON ke.knowledge_id = kb.id
    WHERE ke.account_id = p_account_id
    AND (1 - (ke.embedding <=> p_embedding)) > p_threshold
    ORDER BY ke.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER knowledge_base_updated_at
    BEFORE UPDATE ON knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policies (service_role only for now)
CREATE POLICY "service_role_only_knowledge_base" ON knowledge_base FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_only_embeddings" ON knowledge_embeddings FOR ALL TO service_role USING (true);
