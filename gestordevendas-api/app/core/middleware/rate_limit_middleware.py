"""
Middleware de Rate Limiting por Tenant e Endpoint.

Aplica limites de requisições baseado em:
1. Tenant (account_id)
2. Método HTTP (GET, POST, PUT, DELETE)
3. Endpoint específico
4. Super Admin (sem limite)
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from datetime import datetime, timedelta

from app.core.rate_limit import (
    get_rate_limiter,
    rate_limit_for_endpoint,
    RateLimitLevel,
)
from app.core.context import get_tenant_id, get_is_super_admin


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware que aplica rate limiting por tenant e endpoint."""

    async def dispatch(self, request: Request, call_next):
        """Processa requisição com rate limiting."""

        # Endpoints públicos (sem rate limit)
        public_paths = ["/health", "/docs", "/openapi.json"]
        if any(request.url.path.startswith(path) for path in public_paths):
            return await call_next(request)

        try:
            # Super Admin não é limitado
            is_super_admin = get_is_super_admin()
            if is_super_admin:
                return await call_next(request)

            # Obter tenant_id e IP
            tenant_id = get_tenant_id()
            ip = request.client.host if request.client else "unknown"

            # Chave para rate limit: usar tenant_id se disponível, senão IP
            key = tenant_id or ip

            # Determinar nível de rate limit baseado no método HTTP
            level = self._get_rate_limit_level(request)

            # Verificar limite
            limiter = get_rate_limiter()
            allowed, reason = limiter.check_limit(key, level)

            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"error": "Too Many Requests", "detail": reason},
                    headers={
                        "Retry-After": "60",
                        "X-RateLimit-Reason": reason,
                    },
                )

        except Exception as e:
            # Em caso de erro, deixar passar (fail-open)
            print(f"⚠️  Erro em RateLimitMiddleware: {e}")
            pass

        response = await call_next(request)

        # Adicionar headers informativos se conseguir obter stats
        try:
            key = tenant_id or ip
            limiter = get_rate_limiter()
            stats = limiter.get_stats(key)

            if stats:
                response.headers["X-RateLimit-Limit"] = str(stats["limit_per_minute"])
                response.headers["X-RateLimit-Remaining"] = str(
                    max(0, stats["limit_per_minute"] - stats["requests_this_minute"])
                )
                response.headers["X-RateLimit-Reset"] = str(
                    int((datetime.utcnow() + timedelta(minutes=1)).timestamp())
                )
                response.headers["X-RateLimit-Percentage"] = (
                    f"{stats['percentage_used_minute']}%"
                )
        except Exception:
            pass

        return response

    def _get_rate_limit_level(self, request: Request) -> RateLimitLevel:
        """Determinar nível de rate limit baseado no endpoint e método."""

        # /super/* endpoints não são limitados
        if "/super/" in request.url.path:
            return RateLimitLevel.UNLIMITED

        # /auth/* endpoints são estritamente limitados
        if "/auth/" in request.url.path:
            return RateLimitLevel.AUTH

        # Baseado no método HTTP
        if request.method == "GET":
            return RateLimitLevel.RELAXED
        elif request.method == "DELETE":
            return RateLimitLevel.STRICT
        else:  # POST, PUT, PATCH
            return RateLimitLevel.NORMAL
