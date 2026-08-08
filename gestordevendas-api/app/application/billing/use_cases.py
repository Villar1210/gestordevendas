"""
Use cases de Billing.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.application.billing.quota_service import QuotaService
from app.domain.exceptions import ValidationError
from app.infra.supabase.billing_repo import BillingRepository

logger = structlog.get_logger(__name__)

VALID_PLANS = {"free", "pro", "enterprise"}
VALID_SUBSCRIPTION_STATUSES = {"active", "trialing", "past_due", "canceled", "unpaid"}


class GetBillingStatusUseCase:
    """Retorna uso atual vs limites do plano para exibir no dashboard."""

    def __init__(self, account_id: UUID):
        self._account_id = account_id

    def execute(self) -> dict:
        return QuotaService(self._account_id).get_status()


class CreateCheckoutSessionUseCase:
    """Cria uma Checkout Session Stripe para upgrade de plano."""

    def __init__(self, account_id: UUID):
        self._account_id = account_id
        self._repo = BillingRepository(account_id)

    def execute(
        self,
        *,
        plan: str,
        customer_email: str,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> dict:
        from app.core.config import get_settings
        from app.infra.stripe.client import StripeClient

        settings = get_settings()

        if plan not in ("pro", "enterprise"):
            raise ValidationError("Checkout disponível apenas para planos 'pro' e 'enterprise'.")

        price_id = settings.STRIPE_PRICE_PRO if plan == "pro" else settings.STRIPE_PRICE_ENTERPRISE
        if not price_id:
            raise ValidationError(
                f"STRIPE_PRICE_{plan.upper()} não configurado nas variáveis de ambiente."
            )

        return StripeClient.create_checkout_session(
            customer_email=customer_email,
            price_id=price_id,
            account_id=str(self._account_id),
            success_url=success_url or f"{settings.FRONTEND_URL}/billing/success",
            cancel_url=cancel_url or f"{settings.FRONTEND_URL}/billing",
        )


class CreatePortalSessionUseCase:
    """Cria sessão no Customer Portal para gerenciar/cancelar a assinatura."""

    def __init__(self, account_id: UUID):
        self._repo = BillingRepository(account_id)

    def execute(self, *, return_url: Optional[str] = None) -> dict:
        from app.core.config import get_settings
        from app.infra.stripe.client import StripeClient
        from app.domain.exceptions import NotFoundError

        settings = get_settings()
        account = self._repo.get_account()
        customer_id = account.get("stripe_customer_id")

        if not customer_id:
            raise NotFoundError(
                "Este account não possui um customer Stripe. "
                "Assine um plano primeiro via /billing/checkout."
            )

        return StripeClient.create_portal_session(
            stripe_customer_id=customer_id,
            return_url=return_url or f"{settings.FRONTEND_URL}/billing",
        )


class HandleStripeWebhookUseCase:
    """
    Processa eventos do webhook Stripe e atualiza o plano/status do account.

    Eventos tratados:
      - checkout.session.completed   → ativa assinatura + atualiza plan
      - customer.subscription.updated → atualiza plan e status
      - customer.subscription.deleted → cancela assinatura (volta para free)
      - invoice.payment_failed        → marca como past_due
    """

    def execute(self, payload: bytes, sig_header: str) -> dict:
        from app.infra.stripe.client import StripeClient

        event = StripeClient.construct_webhook_event(payload, sig_header)
        event_type = event["type"]
        data = event["data"]["object"]

        logger.info("stripe_webhook_received", event_type=event_type)

        handlers = {
            "checkout.session.completed": self._handle_checkout_completed,
            "customer.subscription.updated": self._handle_subscription_updated,
            "customer.subscription.deleted": self._handle_subscription_deleted,
            "invoice.payment_failed": self._handle_payment_failed,
        }

        handler = handlers.get(event_type)
        if handler:
            try:
                handler(data)
            except Exception as e:
                logger.error("stripe_webhook_handler_error", event_type=event_type, error=str(e))
                # Nunca lançar exceção para o Stripe — ele vai retentar indefinidamente
        else:
            logger.info("stripe_webhook_ignored", event_type=event_type)

        return {"received": True, "event_type": event_type}

    def _handle_checkout_completed(self, data: dict) -> None:
        account_id = data.get("metadata", {}).get("account_id")
        if not account_id:
            logger.warning("stripe_checkout_no_account_id")
            return

        repo = BillingRepository(UUID(account_id))
        subscription_id = data.get("subscription")
        customer_id = data.get("customer")

        # Busca o plan a partir da subscription
        plan = self._plan_from_subscription(subscription_id)

        repo.update_subscription(
            plan=plan,
            stripe_customer_id=customer_id,
            stripe_subscription_id=subscription_id,
            subscription_status="active",
        )
        logger.info("stripe_checkout_activated", account_id=account_id, plan=plan)

    def _handle_subscription_updated(self, data: dict) -> None:
        account_id = data.get("metadata", {}).get("account_id")
        if not account_id:
            # Tenta encontrar account pelo customer_id
            account_id = self._find_account_by_customer(data.get("customer"))
        if not account_id:
            return

        repo = BillingRepository(UUID(account_id))
        status = data.get("status", "active")
        plan = self._plan_from_price_data(data)

        repo.update_subscription(
            plan=plan,
            subscription_status=status,
        )
        logger.info("stripe_subscription_updated", account_id=account_id, status=status, plan=plan)

    def _handle_subscription_deleted(self, data: dict) -> None:
        account_id = data.get("metadata", {}).get("account_id") or \
                     self._find_account_by_customer(data.get("customer"))
        if not account_id:
            return

        repo = BillingRepository(UUID(account_id))
        repo.update_subscription(
            plan="free",
            subscription_status="canceled",
            stripe_subscription_id=None,
        )
        logger.info("stripe_subscription_canceled", account_id=account_id)

    def _handle_payment_failed(self, data: dict) -> None:
        customer_id = data.get("customer")
        account_id = self._find_account_by_customer(customer_id)
        if not account_id:
            return

        repo = BillingRepository(UUID(account_id))
        repo.update_subscription(subscription_status="past_due")
        logger.warning("stripe_payment_failed", account_id=account_id)

    @staticmethod
    def _plan_from_subscription(subscription_id: Optional[str]) -> str:
        """Determina o plano a partir do ID da subscription Stripe."""
        if not subscription_id:
            return "free"
        try:
            from app.core.config import get_settings
            import stripe
            settings = get_settings()
            stripe.api_key = settings.stripe_secret_key
            sub = stripe.Subscription.retrieve(subscription_id)
            price_id = sub["items"]["data"][0]["price"]["id"]
            settings = get_settings()
            if price_id == settings.STRIPE_PRICE_ENTERPRISE:
                return "enterprise"
            if price_id == settings.STRIPE_PRICE_PRO:
                return "pro"
        except Exception as e:
            logger.warning("stripe_plan_lookup_failed", error=str(e))
        return "pro"  # default ao ativar checkout

    @staticmethod
    def _plan_from_price_data(subscription_data: dict) -> str:
        """Extrai o plano dos dados da subscription (evento updated)."""
        try:
            from app.core.config import get_settings
            settings = get_settings()
            items = subscription_data.get("items", {}).get("data", [])
            if items:
                price_id = items[0].get("price", {}).get("id", "")
                if price_id == settings.STRIPE_PRICE_ENTERPRISE:
                    return "enterprise"
                if price_id == settings.STRIPE_PRICE_PRO:
                    return "pro"
        except Exception:
            pass
        return "pro"

    @staticmethod
    def _find_account_by_customer(customer_id: Optional[str]) -> Optional[str]:
        """Busca account pelo stripe_customer_id."""
        if not customer_id:
            return None
        try:
            from app.core.supabase import get_supabase_admin
            result = (
                get_supabase_admin()
                .table("accounts")
                .select("id")
                .eq("stripe_customer_id", customer_id)
                .single()
                .execute()
            )
            return str(result.data["id"]) if result.data else None
        except Exception:
            return None
