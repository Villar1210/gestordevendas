"""
Gestor de Vendas CRM — FastAPI Backend
Ponto de entrada principal da aplicação.
"""
import logging
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.internal.router import router as internal_router
from app.api.v1.router import router as v1_router
from app.application.billing.quota_service import PaymentRequiredError
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.domain.exceptions import (
    DomainError, ForbiddenError, NotFoundError,
    TenantIsolationError, UnauthorizedError, ValidationError,
)

# ─── Logging estruturado ──────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer() if get_settings().is_development
        else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


# ─── Lifespan (startup / shutdown) ───────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_settings()
    logger.info("Gestor de Vendas API iniciando", env=cfg.APP_ENV, debug=cfg.DEBUG)

    # Configura storage do rate limiter com Redis (se disponível)
    try:
        limiter._storage_uri = cfg.REDIS_URL
    except Exception:
        pass  # Fallback para memória local se Redis não estiver disponível

    yield
    logger.info("Gestor de Vendas API encerrando")


# ─── Aplicação FastAPI ────────────────────────────────────────────────────────

cfg = get_settings()

app = FastAPI(
    title="Gestor de Vendas CRM — API",
    description=(
        "Backend FastAPI do Gestor de Vendas CRM.\n\n"
        "**Auth Dashboard:** `Authorization: Bearer <supabase_jwt>`\n\n"
        "**Auth API Pública:** `Authorization: Bearer wacrm_live_<api_key>`"
    ),
    version="1.0.0",
    docs_url="/docs" if cfg.is_development else None,
    redoc_url="/redoc" if cfg.is_development else None,
    openapi_url="/openapi.json" if cfg.is_development else None,
    lifespan=lifespan,
)

# ─── Rate Limiting ─────────────────────────────────────────────────────────────

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Middleware: log de requisições ──────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration_ms, 2),
    )
    return response


# ─── Exception handlers ───────────────────────────────────────────────────────

@app.exception_handler(UnauthorizedError)
async def unauthorized_handler(request: Request, exc: UnauthorizedError):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": exc.message},
    )


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"detail": exc.message},
    )


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": exc.message},
    )


@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.message},
    )


@app.exception_handler(TenantIsolationError)
async def tenant_isolation_handler(request: Request, exc: TenantIsolationError):
    logger.critical(
        "VIOLAÇÃO DE ISOLAMENTO MULTI-TENANT",
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"detail": "Acesso negado"},
    )


@app.exception_handler(PaymentRequiredError)
async def payment_required_handler(request: Request, exc: PaymentRequiredError):
    return JSONResponse(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        content={
            "detail": str(exc),
            "resource": exc.resource,
            "current": exc.current,
            "limit": exc.limit,
            "plan": exc.plan,
            "upgrade_url": "/api/account/billing/checkout",
        },
    )


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.message},
    )


# ─── Rotas base ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"], summary="Health check básico")
async def health():
    """Endpoint leve para Docker healthcheck e load balancers."""
    return {
        "status": "healthy",
        "service": "gestordevendas-api",
        "version": "1.0.0",
        "env": cfg.APP_ENV,
    }


@app.get("/health/detailed", tags=["System"], summary="Health check detalhado")
async def health_detailed():
    """
    Verifica conectividade com Supabase, Redis e workers Celery.
    Use apenas internamente (monitoramento) — não expor publicamente em produção.
    """
    from app.core.health import get_detailed_health
    result = get_detailed_health()
    http_status = status.HTTP_200_OK if result["status"] == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=result, status_code=http_status)


@app.get("/", tags=["System"], summary="Root")
async def root():
    return {
        "name": "Gestor de Vendas CRM — API",
        "version": "1.0.0",
        "docs": "/docs" if cfg.is_development else "disabled in production",
    }


# ─── Registrar routers ────────────────────────────────────────────────────────

app.include_router(internal_router)   # /api/* — dashboard (JWT)
app.include_router(v1_router)         # /v1/*  — API pública / webhooks
