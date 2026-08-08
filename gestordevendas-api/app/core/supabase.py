"""
Clientes Supabase da aplicação.

- supabase_admin : service_role — acesso irrestrito (sem RLS).
  Usado APENAS no backend, NUNCA exposto ao frontend ou enviado em respostas.
- supabase_anon  : anon key  — acesso com RLS ativo.
  Pode ser usado quando queremos garantir que o RLS é respeitado.
"""
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase_admin() -> Client:
    """
    Cliente com service_role.
    Bypass total do RLS — use com cuidado.
    Sempre filtre manualmente por account_id nos queries.
    """
    cfg = get_settings()
    return create_client(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY)


@lru_cache
def get_supabase_anon() -> Client:
    """
    Cliente com anon key.
    RLS ativo — requer usuário autenticado para a maioria das operações.
    """
    cfg = get_settings()
    return create_client(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)


# Alias para compatibilidade
def get_supabase_client() -> Client:
    """
    Alias para get_supabase_admin().
    Retorna cliente com service_role (sem RLS).
    """
    return get_supabase_admin()
