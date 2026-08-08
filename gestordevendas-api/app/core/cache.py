"""
Redis Caching Strategy - Performance Optimization

Estratégia de cache para reduzir queries e melhorar performance.
"""

import json
from datetime import datetime, timedelta
from typing import Any, Callable, Optional, TypeVar, Generic
from functools import wraps
import redis
from app.core.context import get_context

# Redis client
redis_client = redis.from_url(
    os.getenv("REDIS_URL", "redis://localhost:6379"),
    decode_responses=True
)

# Type variable for generic caching
T = TypeVar("T")


class CacheConfig:
    """Configuração de cache por recurso."""

    # TTL em segundos
    ACCOUNT_TTL = 300  # 5 minutos
    PROFILE_TTL = 300
    CONTACT_TTL = 60   # 1 minuto (dados mais dinâmicos)
    CONVERSATION_TTL = 30
    LEAD_TTL = 120     # 2 minutos

    # Invalidation keys
    ACCOUNT_KEY = "account:{account_id}"
    PROFILE_KEY = "profile:{profile_id}"
    CONTACT_KEY = "contact:{contact_id}:tenant:{tenant_id}"
    CONVERSATION_KEY = "conversation:{conversation_id}"
    LEAD_KEY = "lead:{lead_id}:tenant:{tenant_id}"

    # List cache
    ACCOUNTS_LIST_KEY = "accounts:list"
    PROFILES_LIST_KEY = "profiles:tenant:{tenant_id}:list"
    CONTACTS_LIST_KEY = "contacts:tenant:{tenant_id}:list"
    CONVERSATIONS_LIST_KEY = "conversations:tenant:{tenant_id}:list"


class CacheManager:
    """Gerenciador de cache com padrão de invalidação."""

    @staticmethod
    def get(key: str, default: Any = None) -> Any:
        """Obter valor do cache."""
        try:
            value = redis_client.get(key)
            if value:
                return json.loads(value)
            return default
        except Exception as e:
            # Em caso de erro, retornar default (cache não é crítico)
            return default

    @staticmethod
    def set(key: str, value: Any, ttl: int) -> bool:
        """Definir valor no cache."""
        try:
            redis_client.setex(
                key,
                ttl,
                json.dumps(value, default=str)  # default=str para datetime
            )
            return True
        except Exception:
            return False

    @staticmethod
    def delete(key: str) -> bool:
        """Deletar valor do cache."""
        try:
            redis_client.delete(key)
            return True
        except Exception:
            return False

    @staticmethod
    def delete_pattern(pattern: str) -> int:
        """Deletar múltiplas chaves por padrão (ex: account:123:*)."""
        try:
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
            return len(keys)
        except Exception:
            return 0

    @staticmethod
    def invalidate_tenant(tenant_id: str):
        """Invalidar todo cache de um tenant."""
        patterns = [
            f"profile:*:tenant:{tenant_id}",
            f"contact:*:tenant:{tenant_id}",
            f"conversation:*:tenant:{tenant_id}",
            f"lead:*:tenant:{tenant_id}",
            f"profiles:tenant:{tenant_id}:list",
            f"contacts:tenant:{tenant_id}:list",
            f"conversations:tenant:{tenant_id}:list",
        ]
        for pattern in patterns:
            CacheManager.delete_pattern(pattern)


def cached(
    key_builder: Callable,
    ttl: int = 300,
    skip_none: bool = True
):
    """
    Decorator para caching automático de funções.

    Uso:
        @cached(
            key_builder=lambda user_id: f"user:{user_id}",
            ttl=300
        )
        async def get_user(user_id: str):
            return await db.get_user(user_id)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            # Construir chave de cache
            cache_key = key_builder(*args, **kwargs)

            # Tentar obter do cache
            cached_value = CacheManager.get(cache_key)
            if cached_value is not None or not skip_none:
                return cached_value

            # Se não estiver em cache, executar função
            result = await func(*args, **kwargs)

            # Salvar no cache se resultado não for None
            if result is not None or not skip_none:
                CacheManager.set(cache_key, result, ttl)

            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            cache_key = key_builder(*args, **kwargs)
            cached_value = CacheManager.get(cache_key)
            if cached_value is not None or not skip_none:
                return cached_value

            result = func(*args, **kwargs)
            if result is not None or not skip_none:
                CacheManager.set(cache_key, result, ttl)

            return result

        # Retornar wrapper correto
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


class CacheStats:
    """Estatísticas de cache."""

    def __init__(self):
        self.hits = 0
        self.misses = 0

    @property
    def hit_rate(self) -> float:
        """Taxa de acerto do cache."""
        total = self.hits + self.misses
        if total == 0:
            return 0.0
        return (self.hits / total) * 100

    def get_stats(self) -> dict:
        """Obter estatísticas."""
        try:
            info = redis_client.info("stats")
            return {
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": self.hit_rate,
                "redis_memory": info.get("used_memory_human"),
                "redis_connected_clients": info.get("connected_clients"),
            }
        except Exception:
            return {
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": self.hit_rate,
            }


cache_stats = CacheStats()


# Estratégias de cache por tipo de recurso

def cache_account(account_id: str):
    """Chave de cache para account."""
    return CacheConfig.ACCOUNT_KEY.format(account_id=account_id)


def cache_profile(profile_id: str):
    """Chave de cache para profile."""
    return CacheConfig.PROFILE_KEY.format(profile_id=profile_id)


def cache_contact(contact_id: str, tenant_id: str):
    """Chave de cache para contact."""
    return CacheConfig.CONTACT_KEY.format(
        contact_id=contact_id,
        tenant_id=tenant_id
    )


def cache_conversation(conversation_id: str):
    """Chave de cache para conversation."""
    return CacheConfig.CONVERSATION_KEY.format(conversation_id=conversation_id)


def cache_lead(lead_id: str, tenant_id: str):
    """Chave de cache para lead."""
    return CacheConfig.LEAD_KEY.format(
        lead_id=lead_id,
        tenant_id=tenant_id
    )


def cache_profiles_list(tenant_id: str):
    """Chave de cache para lista de profiles."""
    return CacheConfig.PROFILES_LIST_KEY.format(tenant_id=tenant_id)


def cache_contacts_list(tenant_id: str):
    """Chave de cache para lista de contacts."""
    return CacheConfig.CONTACTS_LIST_KEY.format(tenant_id=tenant_id)


def cache_conversations_list(tenant_id: str):
    """Chave de cache para lista de conversations."""
    return CacheConfig.CONVERSATIONS_LIST_KEY.format(tenant_id=tenant_id)


# Warm-up strategy para cache

async def warmup_cache():
    """
    Aquece o cache com dados frequentemente acessados.
    Executar na inicialização da aplicação.
    """
    logger.info("[Cache] Iniciando warm-up...")

    try:
        # Pré-carregar contas ativas
        active_accounts = await AccountsRepository().find_all(limit=100)
        for account in active_accounts:
            CacheManager.set(
                cache_account(account.id),
                account.dict(),
                CacheConfig.ACCOUNT_TTL
            )

        logger.info(f"[Cache] Warm-up completado: {len(active_accounts)} accounts")
    except Exception as e:
        logger.error(f"[Cache] Erro no warm-up: {e}")


import os
from app.infra.supabase.accounts_repo import AccountsRepository
from app.core.logger import logger
