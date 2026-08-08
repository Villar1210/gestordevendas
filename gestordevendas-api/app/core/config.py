"""
Configurações centrais da aplicação.
Lidas do arquivo .env via Pydantic BaseSettings.
"""
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "change-me-in-production-minimum-32-chars"
    API_PREFIX: str = "/api"
    DEBUG: bool = False

    # ── URLs ─────────────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"

    # ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    # ── Supabase ─────────────────────────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # ── Redis / Celery ───────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Criptografia (chaves IA) ──────────────────────────────────────────────
    ENCRYPTION_KEY: str  # Fernet key base64 (32 bytes)

    # ── Meta Cloud API (WhatsApp) ─────────────────────────────────────────────
    META_APP_SECRET: str = ""
    META_API_VERSION: str = "v21.0"
    META_API_BASE_URL: str = "https://graph.facebook.com"

    # ── Email (Resend) ────────────────────────────────────────────────────────
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@gestordevendas.com.br"

    # ── Stripe (Billing) ─────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_PRO: str = ""          # price_id do plano Pro no Stripe
    STRIPE_PRICE_ENTERPRISE: str = ""   # price_id do plano Enterprise

    # ── Rate limits ───────────────────────────────────────────────────────────
    AI_AUTOREPLY_MAX_PER_CONVERSATION: int = 10
    BROADCAST_BATCH_SIZE: int = 50
    BROADCAST_RATE_PER_SECOND: int = 10

    # ── Propriedades derivadas ────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    """Retorna instância cacheada das configurações."""
    return Settings()
