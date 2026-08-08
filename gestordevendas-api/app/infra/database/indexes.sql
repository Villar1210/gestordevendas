-- Database Indexes for Performance Optimization
-- Execute estes índices após as migrações

-- ─── ACCOUNTS ──────────────────────────────────────────────────────────────

-- Buscar by plan (super admin dashboard)
CREATE INDEX IF NOT EXISTS idx_accounts_plan
ON accounts(plan);

-- Listar contas ativas
CREATE INDEX IF NOT EXISTS idx_accounts_status_created
ON accounts(status, created_at DESC);

-- Contar accounts por plan
CREATE INDEX IF NOT EXISTS idx_accounts_plan_active
ON accounts(plan)
WHERE status = 'active';


-- ─── PROFILES ─────────────────────────────────────────────────────────────

-- Buscar por email (login)
CREATE INDEX IF NOT EXISTS idx_profiles_email_unique
ON profiles(email)
WHERE deleted_at IS NULL;

-- Filtrar por tenant
CREATE INDEX IF NOT EXISTS idx_profiles_account_role
ON profiles(account_id, role, deleted_at);

-- Super admin lookup
CREATE INDEX IF NOT EXISTS idx_profiles_super_user
ON profiles(is_super_user, account_id)
WHERE is_super_user = true;

-- Status do usuário
CREATE INDEX IF NOT EXISTS idx_profiles_status
ON profiles(status, account_id, created_at DESC);


-- ─── CONTACTS ─────────────────────────────────────────────────────────────

-- Buscar por tenant (listagem mais comum)
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_status
ON contacts(account_id, status, created_at DESC);

-- Buscar por email
CREATE INDEX IF NOT EXISTS idx_contacts_email_tenant
ON contacts(email, account_id)
WHERE deleted_at IS NULL;

-- Filtrar por fonte
CREATE INDEX IF NOT EXISTS idx_contacts_source_tenant
ON contacts(source, account_id, created_at DESC);

-- Buscar contatos sem conversa (para engagement)
CREATE INDEX IF NOT EXISTS idx_contacts_no_conversation
ON contacts(account_id, last_interaction_at)
WHERE conversation_id IS NULL;


-- ─── CONVERSATIONS ────────────────────────────────────────────────────────

-- Listar por tenant
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_created
ON conversations(account_id, created_at DESC);

-- Status das conversas
CREATE INDEX IF NOT EXISTS idx_conversations_status
ON conversations(status, account_id, updated_at DESC);

-- Buscar conversas ativas
CREATE INDEX IF NOT EXISTS idx_conversations_active
ON conversations(account_id)
WHERE status IN ('open', 'pending');

-- Listar por canal
CREATE INDEX IF NOT EXISTS idx_conversations_channel
ON conversations(channel, account_id, created_at DESC);


-- ─── LEADS ────────────────────────────────────────────────────────────────

-- Listagem principal
CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage
ON leads(account_id, stage, created_at DESC);

-- Buscar por status
CREATE INDEX IF NOT EXISTS idx_leads_status
ON leads(status, account_id, updated_at DESC);

-- Leads não atribuídos
CREATE INDEX IF NOT EXISTS idx_leads_unassigned
ON leads(account_id)
WHERE assigned_to IS NULL;

-- Buscar por fonte
CREATE INDEX IF NOT EXISTS idx_leads_source
ON leads(source, account_id, created_at DESC);

-- Score do lead
CREATE INDEX IF NOT EXISTS idx_leads_score
ON leads(score DESC, account_id)
WHERE score > 0;


-- ─── AUDIT LOGS ───────────────────────────────────────────────────────────

-- Logs por tenant (mais crítico para compliance)
CREATE INDEX IF NOT EXISTS idx_acesso_plataforma_logs_account
ON acesso_plataforma_logs(account_id, created_at DESC);

-- Logs por super usuário
CREATE INDEX IF NOT EXISTS idx_acesso_plataforma_logs_super_user
ON acesso_plataforma_logs(super_usuario_id, created_at DESC);

-- Logs por ação
CREATE INDEX IF NOT EXISTS idx_acesso_plataforma_logs_acao
ON acesso_plataforma_logs(acao, created_at DESC);

-- Lookup de auditoria por período
CREATE INDEX IF NOT EXISTS idx_acesso_plataforma_logs_period
ON acesso_plataforma_logs(created_at DESC)
WHERE created_at > NOW() - INTERVAL '90 days';


-- ─── MESSAGES (para chat) ──────────────────────────────────────────────────

-- Buscar mensagens de uma conversa
CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON messages(conversation_id, created_at ASC);

-- Mensagens não lidas
CREATE INDEX IF NOT EXISTS idx_messages_unread
ON messages(conversation_id, read_at)
WHERE read_at IS NULL;


-- ─── RATE LIMIT STATE ─────────────────────────────────────────────────────

-- Lookups rápidos por chave (tenant ou IP)
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_minute
ON rate_limit_state(key, window_type)
WHERE window_type = 'minute';

-- Limpeza de rate limits antigos
CREATE INDEX IF NOT EXISTS idx_rate_limit_last_reset
ON rate_limit_state(last_reset)
WHERE last_reset < NOW() - INTERVAL '1 hour';


-- ─── COMPOSITE INDEXES (Queries mais complexas) ────────────────────────────

-- Buscar profile ativo por email
CREATE INDEX IF NOT EXISTS idx_profiles_email_status
ON profiles(email, status, deleted_at);

-- Leads atribuídos a um agent
CREATE INDEX IF NOT EXISTS idx_leads_agent_stage
ON leads(assigned_to, stage, created_at DESC);

-- Conversas por assignee
CREATE INDEX IF NOT EXISTS idx_conversations_assignee_status
ON conversations(assigned_to, status, updated_at DESC);

-- Contatos por criador (para analytics)
CREATE INDEX IF NOT EXISTS idx_contacts_created_by
ON contacts(created_by, account_id, created_at DESC);


-- ─── STATISTICS FOR QUERY PLANNER ─────────────────────────────────────────

-- Atualizar estatísticas para melhor plano de query
ANALYZE accounts;
ANALYZE profiles;
ANALYZE contacts;
ANALYZE conversations;
ANALYZE leads;
ANALYZE acesso_plataforma_logs;
ANALYZE messages;
ANALYZE rate_limit_state;


-- ─── VERIFICAR ÍNDICES CRIADOS ────────────────────────────────────────────

-- Ver todos os índices
-- SELECT * FROM pg_indexes WHERE tablename NOT LIKE 'pg_%' ORDER BY tablename, indexname;

-- Ver tamanho dos índices
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     pg_size_pretty(pg_relation_size(indexrelid)) AS size
-- FROM pg_indexes
-- JOIN pg_class ON pg_class.relname = indexname
-- ORDER BY pg_relation_size(indexrelid) DESC;
