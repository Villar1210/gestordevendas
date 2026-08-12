"""Endpoints para Billing Module (Task 1, Fase 5)"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.billing_schemas import (
    BillingSetup,
    StripeCustomerResponse,
    SubscriptionResponse,
    InvoiceResponse,
)
import os

router = APIRouter(prefix="/billing", tags=["Billing"])

STRIPE_API_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Planos pré-definidos
PLANS = {
    "free": {
        "id": "free",
        "name": "Free",
        "price": 0,
        "features": {"contacts": 10, "users": 1},
    },
    "starter": {
        "id": "price_starter",
        "name": "Starter",
        "price": 2900,  # $29
        "features": {"contacts": 100, "users": 3},
    },
    "professional": {
        "id": "price_professional",
        "name": "Professional",
        "price": 9900,  # $99
        "features": {"contacts": 1000, "users": 10},
    },
}


@router.get("/plans", summary="Listar planos")
async def list_plans():
    """Listar planos disponíveis"""
    return {"plans": list(PLANS.values())}


@router.post("/setup", response_model=StripeCustomerResponse, summary="Configurar faturamento")
async def setup_billing(
    billing_data: BillingSetup,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Configurar dados de faturamento"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    # TODO: Integrar com Stripe API para criar customer
    # Por enquanto, mock response
    return {
        "id": account_id,
        "account_id": account_id,
        "stripe_customer_id": f"cus_mock_{account_id}",
        "billing_email": billing_data.billing_email,
        "billing_name": billing_data.billing_name,
        "created_at": None,
    }


@router.get("/customer", response_model=StripeCustomerResponse, summary="Obter cliente")
async def get_customer(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter dados de faturamento"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    # TODO: Buscar do banco
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não configurado")


@router.get("/subscription", response_model=SubscriptionResponse, summary="Obter subscrição")
async def get_subscription(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter subscrição atual"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    # TODO: Buscar do banco
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sem subscrição ativa")


@router.post("/subscribe", summary="Iniciar subscrição")
async def subscribe(
    plan_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Iniciar subscrição para plano"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    if plan_id not in PLANS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plano inválido")

    plan = PLANS[plan_id]

    # TODO: Integrar com Stripe para criar subscrição
    return {
        "success": True,
        "plan": plan,
        "message": f"Subscrição iniciada: {plan['name']}",
    }


@router.get("/invoices", summary="Listar faturas")
async def list_invoices(
    limit: int = 20,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Listar faturas"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    # TODO: Buscar do banco
    return {"invoices": [], "total": 0, "limit": limit, "offset": offset}


@router.post("/portal", summary="Abrir portal do cliente")
async def open_portal(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Abrir portal do cliente Stripe"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    # TODO: Integrar com Stripe Billing Portal
    return {
        "portal_url": f"https://billing.stripe.com/portal/mock/{account_id}",
    }


@router.post("/webhook", summary="Webhook do Stripe")
async def webhook(
    request: Request,
    supabase=Depends(get_supabase),
):
    """Receber eventos do Stripe"""
    # TODO: Validar assinatura do webhook
    # TODO: Processar eventos (customer.subscription.*, invoice.*, etc)
    return {"received": True}
