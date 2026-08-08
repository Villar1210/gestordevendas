"""
Cliente Stripe — criação de checkout sessions, portal de billing e validação de webhooks.

Requer: pip install stripe
Variáveis de ambiente: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
"""
from __future__ import annotations

import structlog

from app.core.config import get_settings
from app.domain.exceptions import ExternalServiceError

logger = structlog.get_logger(__name__)


def _get_stripe():
    """Import lazy para não quebrar se stripe não estiver instalado."""
    try:
        import stripe
        settings = get_settings()
        stripe.api_key = settings.stripe_secret_key
        return stripe
    except ImportError:
        raise ExternalServiceError(
            "Pacote 'stripe' não instalado. Execute: pip install stripe"
        )
    except AttributeError:
        raise ExternalServiceError(
            "STRIPE_SECRET_KEY não configurada nas variáveis de ambiente."
        )


class StripeClient:

    # ── Checkout Session ───────────────────────────────────────────────────────

    @staticmethod
    def create_checkout_session(
        *,
        customer_email: str,
        price_id: str,
        account_id: str,
        success_url: str,
        cancel_url: str,
    ) -> dict:
        """
        Cria uma Checkout Session para o usuário assinar um plano.
        price_id: ID do Price no Stripe (ex: price_1ABC...).
        Retorna {"url": "https://checkout.stripe.com/..."}.
        """
        stripe = _get_stripe()
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="subscription",
                customer_email=customer_email,
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={"account_id": account_id},
                subscription_data={"metadata": {"account_id": account_id}},
            )
            return {"url": session.url, "session_id": session.id}
        except stripe.error.StripeError as e:
            raise ExternalServiceError(f"Stripe checkout error: {e}") from e

    # ── Customer Portal ────────────────────────────────────────────────────────

    @staticmethod
    def create_portal_session(
        *,
        stripe_customer_id: str,
        return_url: str,
    ) -> dict:
        """
        Cria sessão no Customer Portal (gerenciar/cancelar assinatura).
        """
        stripe = _get_stripe()
        try:
            session = stripe.billing_portal.Session.create(
                customer=stripe_customer_id,
                return_url=return_url,
            )
            return {"url": session.url}
        except stripe.error.StripeError as e:
            raise ExternalServiceError(f"Stripe portal error: {e}") from e

    # ── Webhook Validation ────────────────────────────────────────────────────

    @staticmethod
    def construct_webhook_event(payload: bytes, sig_header: str) -> dict:
        """
        Valida a assinatura do webhook Stripe e retorna o evento.
        Lança ExternalServiceError se a assinatura for inválida.
        """
        stripe = _get_stripe()
        settings = get_settings()
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.stripe_webhook_secret
            )
            return event
        except stripe.error.SignatureVerificationError as e:
            logger.warning("stripe_webhook_invalid_signature", error=str(e))
            raise ExternalServiceError("Assinatura do webhook Stripe inválida.") from e
