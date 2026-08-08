"""
Webhook público do Stripe — /v1/stripe/webhook
Sem autenticação JWT (o Stripe assina o payload com HMAC-SHA256).
Valida a assinatura e delega para HandleStripeWebhookUseCase.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.application.billing.use_cases import HandleStripeWebhookUseCase
from app.domain.exceptions import ExternalServiceError

router = APIRouter(prefix="/stripe", tags=["Stripe Webhook"])


@router.post(
    "/webhook",
    summary="Webhook Stripe (assinado — não requer JWT)",
    status_code=status.HTTP_200_OK,
)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(..., alias="stripe-signature"),
):
    """
    Recebe eventos do Stripe (subscription criada, atualizada, cancelada, etc.)
    e atualiza o plano/status do account correspondente.

    IMPORTANTE: não altere o corpo da requisição antes de validar a assinatura.
    O Stripe rejeita re-tentativas se receber status ≠ 200.
    """
    payload = await request.body()

    try:
        uc = HandleStripeWebhookUseCase()
        result = uc.execute(payload=payload, sig_header=stripe_signature)
        return result
    except ExternalServiceError as e:
        # Assinatura inválida — retorna 400 para o Stripe não retentar
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Erro interno — retorna 200 de qualquer forma para evitar re-tentativas infinitas
        # O erro já foi logado dentro do use case
        return {"received": True, "warning": "handler_error"}
