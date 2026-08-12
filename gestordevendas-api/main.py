"""
Gestor de Vendas CRM — FastAPI Main Server
Production-ready com segurança, rate limiting, CORS, logging, etc.
"""
import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# ── Importar routers ────────────────────────────────────────────────────────
from app.api.internal.router import router as internal_router

# ── Configurar logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/app.log'),
    ],
)
logger = logging.getLogger(__name__)

# ── Variáveis de ambiente ──────────────────────────────────────────────────
ENV = os.getenv("APP_ENV", "development")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# ── Rate Limiter ────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Criar aplicação FastAPI ────────────────────────────────────────────────
app = FastAPI(
    title="Gestor de Vendas CRM API",
    description="API Python/FastAPI para CRM imobiliário",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── Middleware de segurança ────────────────────────────────────────────────
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=ALLOWED_ORIGINS + ["localhost", "127.0.0.1"],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    expose_headers=["Content-Range", "X-Content-Range"],
    allow_headers=["*"],
)

# ── Configurar rate limiter na app ─────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Handler customizado para rate limit excedido"""
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )


# ── Health check ───────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check do servidor"""
    return {
        "status": "ok",
        "environment": ENV,
        "debug": DEBUG,
    }


# ── Ping autenticado ───────────────────────────────────────────────────────
@app.get("/ping", tags=["Health"])
async def ping():
    """Ping simples"""
    return {"message": "pong"}


# ── Registrar routers ──────────────────────────────────────────────────────
app.include_router(internal_router)


# ── Documentação OpenAPI customizada ───────────────────────────────────────
def custom_openapi():
    """Customizar documentação OpenAPI"""
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Gestor de Vendas CRM API",
        version="1.0.0",
        description="API completa para CRM imobiliário com suporte a WhatsApp, templates, kanban, e muito mais",
        routes=app.routes,
    )

    openapi_schema["info"]["x-logo"] = {
        "url": "https://gestordevendas.com.br/logo.png"
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


# ── Middleware de logging ──────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log de todas as requisições"""
    logger.info(
        f"{request.method} {request.url.path} | "
        f"Client: {request.client.host if request.client else 'unknown'}"
    )
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


# ── Inicialização ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=DEBUG,
        workers=1 if DEBUG else int(os.getenv("WORKERS", 4)),
        log_level="info" if not DEBUG else "debug",
    )
