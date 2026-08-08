"""
Router da API Pública v1 — autenticada por API Key (Bearer wacrm_live_...).
"""
from fastapi import APIRouter

# ── Fase 3: Webhook WhatsApp (público — verificação por assinatura HMAC) ──────
from app.api.v1 import whatsapp_webhook

# ── Fase 7: Webhook Stripe (público — verificação por assinatura Stripe) ──────
from app.api.v1 import stripe_webhook

router = APIRouter(prefix="/v1", tags=["API Pública v1"])


@router.get("/ping", summary="Ping público API v1")
async def ping():
    """Confirma que a API pública v1 está ativa."""
    return {"status": "ok", "version": "v1"}


# ── Fase 3 ────────────────────────────────────────────────────────────────────
router.include_router(whatsapp_webhook.router)
router.include_router(stripe_webhook.router)

# ── Fases futuras ─────────────────────────────────────────────────────────────
# router.include_router(contacts.router,       prefix="/contacts",       tags=["v1/Contacts"])
# router.include_router(conversations.router,  prefix="/conversations",  tags=["v1/Conversations"])
# router.include_router(broadcasts.router,     prefix="/broadcasts",     tags=["v1/Broadcasts"])
