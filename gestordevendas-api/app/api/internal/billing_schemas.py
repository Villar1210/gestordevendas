"""Schemas para Billing Module (Task 1, Fase 5)"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class BillingSetup(BaseModel):
    """Configurar faturamento"""
    billing_email: EmailStr
    billing_name: str = Field(..., max_length=255)

    model_config = {"from_attributes": True}


class StripeCustomerResponse(BaseModel):
    """Resposta do cliente Stripe"""
    id: str
    account_id: str
    stripe_customer_id: str
    billing_email: str
    billing_name: str
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class SubscriptionResponse(BaseModel):
    """Resposta de subscrição"""
    id: str
    account_id: str
    stripe_subscription_id: str
    plan_id: str
    plan_name: str
    status: str
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    """Resposta de fatura"""
    id: str
    account_id: str
    stripe_invoice_id: str
    amount_paid: int
    amount_due: int
    status: str
    invoice_pdf_url: Optional[str] = None
    paid_at: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class PlanInfo(BaseModel):
    """Informações de plano"""
    id: str
    name: str
    price: int  # Em centavos
    currency: str = "brl"
    description: str
    features: dict

    model_config = {"from_attributes": True}


class SubscribeRequest(BaseModel):
    """Iniciar subscrição"""
    plan_id: str
    payment_method_id: str

    model_config = {"from_attributes": True}


class PaymentMethodResponse(BaseModel):
    """Método de pagamento"""
    id: str
    type: str
    card_brand: Optional[str] = None
    card_last4: Optional[str] = None
    card_exp_month: Optional[int] = None
    card_exp_year: Optional[int] = None
    is_default: bool

    model_config = {"from_attributes": True}
