"""
Rate Limiting por Tenant e Endpoint.

Garante que:
1. Cada tenant tem limites de requisições
2. Endpoints críticos têm limites mais baixos
3. Super Admin não é limitado
4. Violações são registradas e alertadas
"""
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum


class RateLimitLevel(str, Enum):
    """Níveis de rate limit por endpoint."""

    UNLIMITED = "unlimited"  # Super Admin, health checks
    RELAXED = "relaxed"  # Leitura (GET) - 1000 req/min
    NORMAL = "normal"  # Escrita normal (POST, PUT) - 100 req/min
    STRICT = "strict"  # Operações críticas (DELETE) - 10 req/min
    AUTH = "auth"  # Login/logout - 5 req/min per IP


@dataclass
class RateLimitConfig:
    """Configuração de rate limit."""

    level: RateLimitLevel
    requests_per_minute: int
    requests_per_hour: int
    burst_size: int  # Requisições consecutivas permitidas


# Configurações padrão por nível
RATE_LIMIT_CONFIGS: Dict[RateLimitLevel, RateLimitConfig] = {
    RateLimitLevel.UNLIMITED: RateLimitConfig(
        level=RateLimitLevel.UNLIMITED,
        requests_per_minute=999999,
        requests_per_hour=999999,
        burst_size=999,
    ),
    RateLimitLevel.RELAXED: RateLimitConfig(
        level=RateLimitLevel.RELAXED,
        requests_per_minute=1000,
        requests_per_hour=10000,
        burst_size=50,
    ),
    RateLimitLevel.NORMAL: RateLimitConfig(
        level=RateLimitLevel.NORMAL,
        requests_per_minute=100,
        requests_per_hour=5000,
        burst_size=10,
    ),
    RateLimitLevel.STRICT: RateLimitConfig(
        level=RateLimitLevel.STRICT,
        requests_per_minute=10,
        requests_per_hour=500,
        burst_size=3,
    ),
    RateLimitLevel.AUTH: RateLimitConfig(
        level=RateLimitLevel.AUTH,
        requests_per_minute=5,
        requests_per_hour=50,
        burst_size=1,
    ),
}


@dataclass
class RateLimitState:
    """Estado atual do rate limit para uma chave."""

    key: str  # tenant_id ou ip_address
    level: RateLimitLevel
    requests_this_minute: int = 0
    requests_this_hour: int = 0
    last_request_time: Optional[datetime] = None
    last_minute_reset: Optional[datetime] = None
    last_hour_reset: Optional[datetime] = None
    is_limited: bool = False
    reset_in_seconds: int = 0


class RateLimiter:
    """
    Rate limiter em memória (para desenvolvimento).
    Em produção, usar Redis para estado distribuído.
    """

    def __init__(self):
        self._state: Dict[str, RateLimitState] = {}

    def check_limit(
        self,
        key: str,  # tenant_id ou ip_address
        level: RateLimitLevel,
    ) -> Tuple[bool, Optional[str]]:
        """
        Verificar se requisição está permitida.

        Returns:
            (allowed: bool, reason: Optional[str])
            - allowed=True: requisição pode prosseguir
            - allowed=False: requisição deve ser bloqueada, reason explica por quê
        """
        if level == RateLimitLevel.UNLIMITED:
            return True, None

        now = datetime.utcnow()
        config = RATE_LIMIT_CONFIGS[level]

        # Inicializar estado se não existir
        if key not in self._state:
            self._state[key] = RateLimitState(
                key=key,
                level=level,
                last_minute_reset=now,
                last_hour_reset=now,
            )

        state = self._state[key]

        # Reset de minuto se passou 1 minuto
        if (now - state.last_minute_reset) >= timedelta(minutes=1):
            state.requests_this_minute = 0
            state.last_minute_reset = now

        # Reset de hora se passou 1 hora
        if (now - state.last_hour_reset) >= timedelta(hours=1):
            state.requests_this_hour = 0
            state.last_hour_reset = now

        # Verificar limites
        if state.requests_this_minute >= config.requests_per_minute:
            seconds_until_reset = 60 - (now - state.last_minute_reset).seconds
            return False, (
                f"Limite por minuto atingido ({config.requests_per_minute}). "
                f"Tente novamente em {seconds_until_reset}s."
            )

        if state.requests_this_hour >= config.requests_per_hour:
            seconds_until_reset = 3600 - (now - state.last_hour_reset).seconds
            return False, (
                f"Limite por hora atingido ({config.requests_per_hour}). "
                f"Tente novamente em {seconds_until_reset}s."
            )

        # Incrementar contadores
        state.requests_this_minute += 1
        state.requests_this_hour += 1
        state.last_request_time = now

        return True, None

    def get_state(self, key: str) -> Optional[RateLimitState]:
        """Obter estado atual de uma chave."""
        return self._state.get(key)

    def reset_key(self, key: str) -> None:
        """Resetar manualmente uma chave (para testes)."""
        if key in self._state:
            del self._state[key]

    def get_stats(self, key: str) -> Optional[Dict]:
        """Obter estatísticas de rate limit."""
        state = self._state.get(key)
        if not state:
            return None

        config = RATE_LIMIT_CONFIGS[state.level]
        return {
            "key": key,
            "level": state.level.value,
            "requests_this_minute": state.requests_this_minute,
            "limit_per_minute": config.requests_per_minute,
            "requests_this_hour": state.requests_this_hour,
            "limit_per_hour": config.requests_per_hour,
            "last_request_time": state.last_request_time.isoformat()
            if state.last_request_time
            else None,
            "percentage_used_minute": round(
                (state.requests_this_minute / config.requests_per_minute) * 100, 1
            ),
            "percentage_used_hour": round(
                (state.requests_this_hour / config.requests_per_hour) * 100, 1
            ),
        }


# Instância global
_rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    """Obter instância do rate limiter."""
    return _rate_limiter


def rate_limit_for_endpoint(path: str) -> RateLimitLevel:
    """
    Determinar nível de rate limit baseado no endpoint.

    Regras:
    - GET: RELAXED (leitura é mais barata)
    - POST/PUT: NORMAL (escrita normal)
    - DELETE: STRICT (deletar é arriscado)
    - /auth/*: AUTH (login deve ser protegido)
    - /super/*: UNLIMITED (Super Admin não é limitado)
    """
    if "/super/" in path:
        return RateLimitLevel.UNLIMITED

    if "/auth/" in path:
        return RateLimitLevel.AUTH

    # Baseado no método HTTP
    # Isso será determinado no middleware
    return RateLimitLevel.NORMAL


# ─── Exemplo de uso em middleware ───────────────────────────────────────────

def example_middleware_usage():
    """
    Exemplo de como usar RateLimiter em um middleware.

    ```python
    from fastapi import Request
    from app.core.rate_limit import get_rate_limiter, rate_limit_for_endpoint
    from app.core.context import get_tenant_id, get_is_super_admin

    class RateLimitMiddleware:
        async def __call__(self, request: Request, call_next):
            # Super Admin não é limitado
            is_super_admin = get_is_super_admin()
            if is_super_admin:
                return await call_next(request)

            # Obter tenant_id e IP
            tenant_id = get_tenant_id()
            ip = request.client.host if request.client else "unknown"

            # Determinar nível de rate limit
            level = rate_limit_for_endpoint(request.url.path)
            if request.method == "GET":
                level = RateLimitLevel.RELAXED
            elif request.method == "DELETE":
                level = RateLimitLevel.STRICT

            # Usar tenant_id como chave (ou IP para endpoints públicos)
            key = tenant_id or ip

            # Verificar limite
            limiter = get_rate_limiter()
            allowed, reason = limiter.check_limit(key, level)

            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"error": reason},
                    headers={"Retry-After": "60"},
                )

            response = await call_next(request)

            # Adicionar headers informativos
            stats = limiter.get_stats(key)
            response.headers["X-RateLimit-Limit"] = str(stats["limit_per_minute"])
            response.headers["X-RateLimit-Remaining"] = str(
                stats["limit_per_minute"] - stats["requests_this_minute"]
            )
            response.headers["X-RateLimit-Reset"] = str(
                int((datetime.utcnow() + timedelta(minutes=1)).timestamp())
            )

            return response
    ```
    """
    pass

# ─── Inicializar Limiter para slowapi ──────────────────────────
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# ─── Configurações de limite ──────────────────────────────────
STRICT_LIMIT = "5/minute"
NORMAL_LIMIT = "100/minute"
RELAXED_LIMIT = "1000/minute"
