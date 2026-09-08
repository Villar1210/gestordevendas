-- Migration: add_token_version_and_security_fixes
-- Adiciona campo token_version ao modelo users para suporte a revogacao de sessao.
-- Default 0 preserva todos os usuarios existentes sem forcar re-login imediato;
-- o re-login sera necessario apenas quando o token legado (sem claim "tv") expirar.

ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
