"""Schemas para Plans & Subscriptions (Task 2, Fase 5)"""
from pydantic import BaseModel, Field
from typing import Optional


class PlanResponse(BaseModel):
    """Plano"""
    id: str
    name: str
    price: int  # Centavos
    currency: str
    billing_period: str  # monthly, yearly
    features: dict
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class CreateSubscriptionRequest(BaseModel):
    """Criar subscrição"""
    plan_id: str
    payment_method_id: Optional[str] = None

    model_config = {"from_attributes": True}


class UpgradeSubscriptionRequest(BaseModel):
    """Upgrade de plano"""
    new_plan_id: str

    model_config = {"from_attributes": True}


class SubscriptionDetailResponse(BaseModel):
    """Detalhes de subscrição"""
    id: str
    account_id: str
    plan_id: str
    plan_name: str
    status: str
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    cancel_at_period_end: bool = False
    canceled_at: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class UsageResponse(BaseModel):
    """Uso atual do plano"""
    contacts_used: int
    contacts_limit: int
    users_used: int
    users_limit: int
    storage_used_mb: int
    storage_limit_mb: int

    model_config = {"from_attributes": True}
