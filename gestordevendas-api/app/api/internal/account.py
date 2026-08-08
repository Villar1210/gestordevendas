"""
Router interno: /api/account
Billing, status do plano e upgrade/downgrade. Apenas Owner acessa billing.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.application.billing.use_cases import (
    CreateCheckoutSessionUseCase,
    CreatePortalSessionUseCase,
    GetBillingStatusUseCase,
)
from app.core.dependencies import CurrentUser, require_owner

router = APIRouter(prefix="/account", tags=["Account & Billing"])


class CheckoutRequest(BaseModel):
    plan: str = Field(..., pattern="^(pro|enterprise)$")
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class PortalRequest(BaseModel):
    return_url: Optional[str] = None


@router.get("/billing", summary="Status do plano e uso atual")
async def get_billing_status(
    user: CurrentUser = Depends(require_owner),
):
    """
    Retorna o plano atual, status da assinatura e uso de todos os recursos
    comparado aos limites do plano.
    """
    uc = GetBillingStatusUseCase(user.account_id)
    return uc.execute()


@router.post("/billing/checkout", summary="Criar sessão de checkout para upgrade")
async def create_checkout(
    body: CheckoutRequest,
    user: CurrentUser = Depends(require_owner),
):
    """
    Retorna a URL do Stripe Checkout para o usuário assinar um plano pago.
    Redirecionar o usuário para essa URL para completar o pagamento.
    """
    uc = CreateCheckoutSessionUseCase(user.account_id)
    return uc.execute(
        plan=body.plan,
        customer_email=user.email,   # derivado do JWT — sem exigir do frontend
        success_url=body.success_url,
        cancel_url=body.cancel_url,
    )


@router.post("/billing/portal", summary="Abrir portal de gerenciamento de assinatura")
async def create_portal(
    body: PortalRequest,
    user: CurrentUser = Depends(require_owner),
):
    """
    Retorna a URL do Stripe Customer Portal onde o usuário pode
    alterar cartão de crédito, ver faturas e cancelar a assinatura.
    """
    uc = CreatePortalSessionUseCase(user.account_id)
    return uc.execute(return_url=body.return_url)
