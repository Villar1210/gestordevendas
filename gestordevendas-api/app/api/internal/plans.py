"""Endpoints para Plans & Subscriptions (Task 2, Fase 5)"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.plans_schemas import (
    PlanResponse,
    CreateSubscriptionRequest,
    UpgradeSubscriptionRequest,
    SubscriptionDetailResponse,
    UsageResponse,
)

router = APIRouter(prefix="/plans", tags=["Plans"])

# Planos pré-definidos
PLANS = {
    "free": {
        "id": "free",
        "name": "Gratuito",
        "price": 0,
        "currency": "brl",
        "billing_period": "monthly",
        "features": {
            "contacts": 10,
            "users": 1,
            "storage_mb": 100,
            "api_calls_per_month": 1000,
        },
    },
    "starter": {
        "id": "price_starter",
        "name": "Iniciante",
        "price": 9900,  # R$99
        "currency": "brl",
        "billing_period": "monthly",
        "features": {
            "contacts": 500,
            "users": 3,
            "storage_mb": 1000,
            "api_calls_per_month": 50000,
        },
    },
    "professional": {
        "id": "price_professional",
        "name": "Profissional",
        "price": 29900,  # R$299
        "currency": "brl",
        "billing_period": "monthly",
        "features": {
            "contacts": 5000,
            "users": 10,
            "storage_mb": 10000,
            "api_calls_per_month": 500000,
        },
    },
    "enterprise": {
        "id": "price_enterprise",
        "name": "Enterprise",
        "price": 99900,  # R$999
        "currency": "brl",
        "billing_period": "monthly",
        "features": {
            "contacts": 50000,
            "users": 50,
            "storage_mb": 100000,
            "api_calls_per_month": 5000000,
        },
    },
}


@router.get("", response_model=list[PlanResponse], summary="Listar planos")
async def list_plans():
    """Listar todos os planos disponíveis"""
    plans = []
    for plan_id, plan_data in PLANS.items():
        plans.append(PlanResponse(**plan_data))
    return plans


@router.post("/subscribe", response_model=SubscriptionDetailResponse, summary="Iniciar subscrição")
async def subscribe(
    request: CreateSubscriptionRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Iniciar ou atualizar subscrição"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    if request.plan_id not in PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Plano inválido"
        )

    plan = PLANS[request.plan_id]

    # TODO: Integrar com Stripe para criar subscrição
    return SubscriptionDetailResponse(
        id=f"sub_{account_id}",
        account_id=account_id,
        plan_id=request.plan_id,
        plan_name=plan["name"],
        status="active",
        current_period_start="2026-08-11T00:00:00Z",
        current_period_end="2026-09-11T00:00:00Z",
        cancel_at_period_end=False,
        canceled_at=None,
        created_at="2026-08-11T00:00:00Z",
    )


@router.post("/upgrade", response_model=SubscriptionDetailResponse, summary="Upgrade de plano")
async def upgrade_plan(
    request: UpgradeSubscriptionRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Fazer upgrade para um plano superior"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    if request.new_plan_id not in PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Plano inválido"
        )

    plan = PLANS[request.new_plan_id]

    # TODO: Validar se é um upgrade (novo plano > plano atual)
    # TODO: Integrar com Stripe para atualizar subscrição

    return SubscriptionDetailResponse(
        id=f"sub_{account_id}",
        account_id=account_id,
        plan_id=request.new_plan_id,
        plan_name=plan["name"],
        status="active",
        current_period_start="2026-08-11T00:00:00Z",
        current_period_end="2026-09-11T00:00:00Z",
        cancel_at_period_end=False,
        canceled_at=None,
        created_at="2026-08-11T00:00:00Z",
    )


@router.post("/downgrade", response_model=SubscriptionDetailResponse, summary="Downgrade de plano")
async def downgrade_plan(
    request: UpgradeSubscriptionRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Fazer downgrade para um plano inferior"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    if request.new_plan_id not in PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Plano inválido"
        )

    plan = PLANS[request.new_plan_id]

    # TODO: Validar se é um downgrade (novo plano < plano atual)
    # TODO: Integrar com Stripe para atualizar subscrição

    return SubscriptionDetailResponse(
        id=f"sub_{account_id}",
        account_id=account_id,
        plan_id=request.new_plan_id,
        plan_name=plan["name"],
        status="active",
        current_period_start="2026-08-11T00:00:00Z",
        current_period_end="2026-09-11T00:00:00Z",
        cancel_at_period_end=False,
        canceled_at=None,
        created_at="2026-08-11T00:00:00Z",
    )


@router.get("/current", response_model=SubscriptionDetailResponse, summary="Subscrição atual")
async def get_current_subscription(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter subscrição atual da conta"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Buscar subscrição do banco
    plan = PLANS["free"]
    return SubscriptionDetailResponse(
        id=f"sub_{account_id}",
        account_id=account_id,
        plan_id="free",
        plan_name=plan["name"],
        status="active",
        current_period_start="2026-08-11T00:00:00Z",
        current_period_end="2026-09-11T00:00:00Z",
        cancel_at_period_end=False,
        canceled_at=None,
        created_at="2026-08-11T00:00:00Z",
    )


@router.post("/cancel", summary="Cancelar subscrição")
async def cancel_subscription(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Cancelar subscrição no final do período"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Integrar com Stripe para cancelar subscrição

    return {
        "success": True,
        "message": "Subscrição será cancelada no final do período",
        "canceled_at": "2026-09-11T00:00:00Z",
    }


@router.get("/usage", response_model=UsageResponse, summary="Uso atual")
async def get_usage(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter uso atual do plano"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Buscar uso atual do banco (contatos, usuários, armazenamento)

    return UsageResponse(
        contacts_used=25,
        contacts_limit=500,
        users_used=2,
        users_limit=3,
        storage_used_mb=250,
        storage_limit_mb=1000,
    )
