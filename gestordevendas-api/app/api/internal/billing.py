"""Endpoints para Billing Module com Stripe Real (Task 4, Fase 5)"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.billing_schemas import (
    BillingSetup,
    StripeCustomerResponse,
    SubscriptionResponse,
    InvoiceResponse,
)
from app.infra.stripe import StripeService
from app.infra.supabase.stripe_repository import StripeRepository
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["Billing"])

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Planos pré-definidos
PLANS = {
    "free": {
        "id": "free",
        "name": "Gratuito",
        "price": 0,
        "features": {"contacts": 10, "users": 1},
    },
    "starter": {
        "id": "price_starter",
        "name": "Iniciante",
        "price": 9900,
        "features": {"contacts": 500, "users": 3},
    },
    "professional": {
        "id": "price_professional",
        "name": "Profissional",
        "price": 29900,
        "features": {"contacts": 5000, "users": 10},
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
    """Configurar dados de faturamento e criar cliente Stripe"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    try:
        # Criar cliente no Stripe
        stripe_customer = StripeService.create_customer(
            email=billing_data.billing_email,
            name=billing_data.billing_name,
            account_id=account_id,
        )

        # Salvar no banco
        repository = StripeRepository(supabase)
        await repository.save_stripe_customer(
            account_id=account_id,
            stripe_customer_id=stripe_customer["stripe_customer_id"],
            billing_email=billing_data.billing_email,
            billing_name=billing_data.billing_name,
        )

        return StripeCustomerResponse(
            id=account_id,
            account_id=account_id,
            stripe_customer_id=stripe_customer["stripe_customer_id"],
            billing_email=billing_data.billing_email,
            billing_name=billing_data.billing_name,
            created_at=None,
        )
    except Exception as e:
        logger.error(f"Erro ao configurar faturamento: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao configurar faturamento",
        )


@router.get("/customer", response_model=StripeCustomerResponse, summary="Obter cliente")
async def get_customer(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter dados de faturamento"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    try:
        repository = StripeRepository(supabase)
        customer = await repository.get_stripe_customer(account_id)

        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não configurado"
            )

        return StripeCustomerResponse(
            id=account_id,
            account_id=customer["account_id"],
            stripe_customer_id=customer["stripe_customer_id"],
            billing_email=customer["billing_email"],
            billing_name=customer["billing_name"],
            created_at=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar cliente: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar cliente",
        )


@router.get("/subscription", response_model=SubscriptionResponse, summary="Obter subscrição")
async def get_subscription(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter subscrição atual"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    try:
        repository = StripeRepository(supabase)
        subscription = await repository.get_subscription(account_id)

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Sem subscrição ativa"
            )

        return SubscriptionResponse(
            id=subscription["stripe_subscription_id"],
            account_id=subscription["account_id"],
            stripe_subscription_id=subscription["stripe_subscription_id"],
            plan_id=subscription["plan_id"],
            plan_name=PLANS[subscription["plan_id"]]["name"],
            status=subscription["status"],
            current_period_start=subscription["current_period_start"],
            current_period_end=subscription["current_period_end"],
            created_at=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar subscrição: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar subscrição",
        )


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

    if plan_id == "free":
        return {"success": True, "message": "Plano gratuito ativado"}

    try:
        plan = PLANS[plan_id]
        repository = StripeRepository(supabase)

        # Obter cliente Stripe
        customer = await repository.get_stripe_customer(account_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente não configurado. Execute POST /billing/setup primeiro.",
            )

        # Obter Price ID do Stripe
        price_id = os.getenv(f"STRIPE_PRICE_{plan_id.upper()}")
        if not price_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Preço do plano não configurado",
            )

        # Criar subscrição no Stripe
        subscription = StripeService.create_subscription(
            customer_id=customer["stripe_customer_id"],
            price_id=price_id,
            account_id=account_id,
        )

        # Salvar subscrição no banco
        await repository.save_subscription(
            account_id=account_id,
            stripe_subscription_id=subscription["stripe_subscription_id"],
            plan_id=plan_id,
            stripe_customer_id=customer["stripe_customer_id"],
            status=subscription["status"],
            current_period_start=subscription["current_period_start"],
            current_period_end=subscription["current_period_end"],
        )

        return {
            "success": True,
            "subscription_id": subscription["stripe_subscription_id"],
            "plan": plan,
            "status": subscription["status"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar subscrição: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar subscrição",
        )


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

    try:
        repository = StripeRepository(supabase)
        invoices = await repository.list_invoices(account_id, limit)

        return {
            "invoices": invoices,
            "total": len(invoices),
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.error(f"Erro ao listar faturas: {str(e)}")
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

    try:
        repository = StripeRepository(supabase)
        customer = await repository.get_stripe_customer(account_id)

        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não configurado"
            )

        # Criar sessão do portal
        return_url = "https://api.ivillar.com.br/dashboard/billing"
        portal_url = StripeService.create_billing_portal_session(
            customer_id=customer["stripe_customer_id"],
            return_url=return_url,
        )

        return {"portal_url": portal_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao abrir portal: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao abrir portal",
        )


@router.post("/webhook", summary="Webhook do Stripe")
async def webhook(
    request: Request,
    supabase=Depends(get_supabase),
):
    """Receber eventos do Stripe"""
    try:
        body = await request.body()
        sig_header = request.headers.get("stripe-signature")

        if not sig_header:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assinatura do webhook ausente",
            )

        # Validar assinatura
        event = StripeService.verify_webhook_signature(body, sig_header)

        # Processar evento
        processed = StripeService.handle_webhook_event(event)

        # Atualizar banco se necessário
        if processed["type"] == "subscription_updated":
            repository = StripeRepository(supabase)
            await repository.update_subscription_status(
                processed["subscription_id"], processed["status"]
            )
        elif processed["type"] == "invoice_paid":
            # TODO: Atualizar status da fatura no banco
            pass

        logger.info(f"Webhook processado: {processed['type']}")
        return {"received": True, "type": processed["type"]}

    except ValueError as e:
        logger.warning(f"Webhook inválido: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    except Exception as e:
        logger.error(f"Erro ao processar webhook: {str(e)}")
        return {"received": False, "error": str(e)}
