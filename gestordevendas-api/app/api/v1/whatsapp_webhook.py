"""
Webhook público da Meta WhatsApp Cloud API.
Registrado em: GET/POST /v1/webhooks/whatsapp

Segurança:
- GET:  verifica hub.verify_token contra o token configurado na inbox.
- POST: valida assinatura HMAC-SHA256 (X-Hub-Signature-256) antes de processar.
        Retorna 200 imediatamente (Meta exige resposta rápida) — processamento
        real acontece em background via Celery (TODO) ou inline por ora.

A Meta identifica para qual número a mensagem chegou via metadata.phone_number_id.
Usamos isso para encontrar a inbox (e o account_id) antes de processar.
"""
from __future__ import annotations

import hashlib
import hmac

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, status

from app.application.whatsapp.webhook_processor import WebhookProcessor
from app.core.config import get_settings
from app.infra.supabase.inboxes_repo import InboxesRepository

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/webhooks/whatsapp", tags=["WhatsApp Webhook"])

# A Meta aceita só um endpoint de webhook por App — o phone_number_id
# dentro do payload identifica para qual inbox/account a mensagem vai.


@router.get("", summary="Verificação do webhook pela Meta")
async def verify_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
):
    """
    A Meta faz GET neste endpoint durante a configuração do webhook.
    Retorna hub.challenge se o verify_token bater com alguma inbox ativa.
    """
    if hub_mode != "subscribe":
        raise HTTPException(status_code=400, detail="hub.mode inválido")

    # Verifica se existe alguma inbox com esse verify_token
    # (multi-tenant: qualquer inbox de qualquer account)
    client = _get_admin_client()
    result = (
        client.table("inboxes")
        .select("id")
        .eq("webhook_verify_token", hub_verify_token)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if not result.data:
        logger.warning("webhook_verify_token_not_found", token_prefix=hub_verify_token[:8])
        raise HTTPException(status_code=403, detail="verify_token inválido")

    # Marca a inbox como verificada pela Meta
    inbox_id = result.data[0]["id"]
    client.table("inboxes").update({"webhook_verified": True}).eq("id", inbox_id).execute()
    logger.info("webhook_verified_ok", inbox_id=inbox_id)

    return int(hub_challenge)


@router.post("", summary="Receber eventos do WhatsApp")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Recebe eventos (mensagens, status) da Meta.
    1. Valida assinatura HMAC-SHA256.
    2. Identifica inbox pelo phone_number_id.
    3. Processa em background (não bloqueia resposta à Meta).
    """
    raw_body = await request.body()

    # ── 1. Validar assinatura ─────────────────────────────────────────────────
    signature_header = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_signature(raw_body, signature_header):
        logger.warning("webhook_invalid_signature")
        raise HTTPException(status_code=403, detail="Assinatura inválida")

    payload = await request.json() if raw_body else {}

    # ── 2. Identificar inbox pelo phone_number_id ─────────────────────────────
    phone_number_id = _extract_phone_number_id(payload)
    if not phone_number_id:
        # Pode ser um teste de ping da Meta (sem messages)
        logger.debug("webhook_no_phone_number_id", payload_keys=list(payload.keys()))
        return {"status": "ok"}

    # Busca sem account_id — o phone_number_id é único globalmente no sistema
    client = _get_admin_client()
    inbox_row = (
        client.table("inboxes")
        .select("id, account_id, is_active")
        .eq("phone_number_id", phone_number_id)
        .limit(1)
        .execute()
    )

    if not inbox_row.data:
        logger.warning("webhook_inbox_not_found", phone_number_id=phone_number_id)
        return {"status": "ok"}  # Retorna 200 mesmo assim (evita retry da Meta)

    inbox = inbox_row.data[0]
    if not inbox.get("is_active"):
        logger.info("webhook_inbox_inactive", inbox_id=inbox["id"])
        return {"status": "ok"}

    # ── 3. Processar em background ────────────────────────────────────────────
    from uuid import UUID
    account_id = UUID(inbox["account_id"])
    inbox_id = UUID(inbox["id"])

    background_tasks.add_task(
        _process_webhook,
        payload=payload,
        account_id=account_id,
        inbox_id=inbox_id,
    )

    # Meta exige resposta 200 imediata
    return {"status": "ok"}


# ── Funções auxiliares ────────────────────────────────────────────────────────

def _verify_signature(body: bytes, signature_header: str) -> bool:
    """Valida X-Hub-Signature-256 com META_APP_SECRET."""
    if not signature_header.startswith("sha256="):
        return False
    expected = signature_header[7:]
    secret = get_settings().META_APP_SECRET.encode()
    computed = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, expected)


def _extract_phone_number_id(payload: dict) -> str | None:
    """Extrai o phone_number_id do payload da Meta."""
    try:
        return (
            payload["entry"][0]["changes"][0]["value"]["metadata"]["phone_number_id"]
        )
    except (KeyError, IndexError, TypeError):
        return None


def _get_admin_client():
    from app.core.supabase import get_supabase_admin
    return get_supabase_admin()


def _process_webhook(payload: dict, account_id, inbox_id) -> None:
    """Executado em background thread pelo FastAPI BackgroundTasks."""
    try:
        processor = WebhookProcessor(account_id=account_id, inbox_id=inbox_id)
        processor.process(payload)
    except Exception as e:
        logger.error(
            "webhook_processing_error",
            error=str(e),
            account_id=str(account_id),
            inbox_id=str(inbox_id),
        )
