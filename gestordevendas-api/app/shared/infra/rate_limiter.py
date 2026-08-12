"""
Rate Limiting Middleware
Protege contra abuso de API
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from functools import wraps

# ── Limiter global ──────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ── Configurações de rate limit por endpoint ──────────────────────────────
RATE_LIMITS = {
    # ── Auth ────────────────────────────────────────────────────────────
    "auth:login": "5/minute",  # Login: 5 tentativas/minuto
    "auth:register": "3/minute",  # Cadastro: 3 tentativas/minuto
    "auth:forgot_password": "3/hour",  # Recuperar senha: 3/hora

    # ── CRUD básico ────────────────────────────────────────────────────
    "templates:create": "30/minute",
    "templates:list": "60/minute",
    "templates:update": "30/minute",
    "templates:delete": "30/minute",

    # ── Kanban ─────────────────────────────────────────────────────────
    "kanban:reorder": "30/minute",
    "kanban:update_order": "30/minute",

    # ── Knowledge Base ─────────────────────────────────────────────────
    "knowledge:search": "60/minute",
    "knowledge:create": "30/minute",

    # ── Metrics ────────────────────────────────────────────────────────
    "metrics:kpi": "60/minute",
    "metrics:trends": "60/minute",
    "metrics:team": "60/minute",

    # ── Settings ───────────────────────────────────────────────────────
    "settings:get": "120/minute",
    "settings:update": "30/minute",

    # ── Default (catch-all) ────────────────────────────────────────────
    "default": "100/minute",
}


def rate_limit(key: str = "default"):
    """
    Decorator para aplicar rate limit a um endpoint

    Usage:
        @app.get("/some-endpoint")
        @rate_limit("templates:list")
        async def some_endpoint():
            ...
    """
    def decorator(func):
        limit_config = RATE_LIMITS.get(key, RATE_LIMITS["default"])

        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await limiter.limit(limit_config)(func)(*args, **kwargs)

        return wrapper

    return decorator


# ── Configurações por ambiente ──────────────────────────────────────────
ENVIRONMENT_CONFIGS = {
    "development": {
        # Em desenvolvimento, limits mais altos
        "auth:login": "100/minute",
        "templates:create": "100/minute",
        "default": "1000/minute",
    },
    "production": {
        # Em produção, limits mais rigorosos
        "auth:login": "5/minute",
        "templates:create": "30/minute",
        "default": "100/minute",
    },
    "staging": {
        # Em staging, meio termo
        "auth:login": "10/minute",
        "templates:create": "50/minute",
        "default": "200/minute",
    },
}


def get_rate_limit_config(env: str):
    """Obter configuração de rate limit para um ambiente"""
    return ENVIRONMENT_CONFIGS.get(env, RATE_LIMITS)
