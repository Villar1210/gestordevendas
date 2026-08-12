"""Stripe Service - Encapsula toda a lógica do Stripe"""
import stripe
import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

PLAN_PRICES = {
    "free": None,  # Sem price ID para plano gratuito
    "starter": os.getenv("STRIPE_PRICE_STARTER"),
    "professional": os.getenv("STRIPE_PRICE_PROFESSIONAL"),
    "enterprise": os.getenv("STRIPE_PRICE_ENTERPRISE"),
}


class StripeService:
    """Serviço para interagir com Stripe"""

    @staticmethod
    def create_customer(email: str, name: str, account_id: str) -> dict:
        """Criar cliente no Stripe"""
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"account_id": account_id},
            )
            logger.info(f"Stripe customer created: {customer.id} for account {account_id}")
            return {
                "stripe_customer_id": customer.id,
                "email": customer.email,
                "name": customer.name,
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating customer: {str(e)}")
            raise

    @staticmethod
    def create_subscription(
        customer_id: str,
        price_id: str,
        account_id: str,
        billing_cycle_anchor: Optional[int] = None,
    ) -> dict:
        """Criar subscrição no Stripe"""
        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": price_id}],
                metadata={"account_id": account_id},
                billing_cycle_anchor=billing_cycle_anchor,
            )
            logger.info(f"Stripe subscription created: {subscription.id}")
            return {
                "stripe_subscription_id": subscription.id,
                "status": subscription.status,
                "current_period_start": subscription.current_period_start,
                "current_period_end": subscription.current_period_end,
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating subscription: {str(e)}")
            raise

    @staticmethod
    def update_subscription(subscription_id: str, price_id: str) -> dict:
        """Atualizar subscrição (upgrade/downgrade)"""
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            updated = stripe.Subscription.modify(
                subscription_id,
                items=[
                    {
                        "id": subscription["items"]["data"][0].id,
                        "price": price_id,
                    }
                ],
                proration_behavior="create_prorations",
            )
            logger.info(f"Stripe subscription updated: {subscription_id}")
            return {
                "stripe_subscription_id": updated.id,
                "status": updated.status,
                "current_period_start": updated.current_period_start,
                "current_period_end": updated.current_period_end,
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error updating subscription: {str(e)}")
            raise

    @staticmethod
    def cancel_subscription(subscription_id: str, at_period_end: bool = True) -> dict:
        """Cancelar subscrição"""
        try:
            if at_period_end:
                updated = stripe.Subscription.modify(
                    subscription_id, cancel_at_period_end=True
                )
            else:
                updated = stripe.Subscription.delete(subscription_id)

            logger.info(f"Stripe subscription canceled: {subscription_id}")
            return {
                "stripe_subscription_id": updated.id,
                "status": updated.status,
                "canceled_at": updated.canceled_at,
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error canceling subscription: {str(e)}")
            raise

    @staticmethod
    def get_subscription(subscription_id: str) -> dict:
        """Obter detalhes da subscrição"""
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            return {
                "stripe_subscription_id": subscription.id,
                "status": subscription.status,
                "current_period_start": subscription.current_period_start,
                "current_period_end": subscription.current_period_end,
                "cancel_at_period_end": subscription.cancel_at_period_end,
                "canceled_at": subscription.canceled_at,
                "price_id": subscription["items"]["data"][0].price.id,
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error retrieving subscription: {str(e)}")
            raise

    @staticmethod
    def list_invoices(customer_id: str, limit: int = 20) -> list:
        """Listar faturas do cliente"""
        try:
            invoices = stripe.Invoice.list(customer=customer_id, limit=limit)
            result = []
            for invoice in invoices.data:
                result.append({
                    "stripe_invoice_id": invoice.id,
                    "amount_paid": invoice.amount_paid,
                    "amount_due": invoice.amount_due,
                    "status": invoice.status,
                    "paid_at": invoice.status_transitions.get("paid_at"),
                    "invoice_pdf_url": invoice.invoice_pdf,
                    "created_at": invoice.created,
                })
            return result
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error listing invoices: {str(e)}")
            raise

    @staticmethod
    def create_billing_portal_session(customer_id: str, return_url: str) -> str:
        """Criar sessão do portal de faturamento"""
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            logger.info(f"Stripe portal session created for {customer_id}")
            return session.url
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating portal session: {str(e)}")
            raise

    @staticmethod
    def verify_webhook_signature(body: bytes, sig_header: str) -> dict:
        """Validar assinatura do webhook do Stripe"""
        try:
            event = stripe.Webhook.construct_event(
                body, sig_header, STRIPE_WEBHOOK_SECRET
            )
            logger.info(f"Webhook validado: {event['type']}")
            return event
        except ValueError:
            logger.error("Webhook inválido - payload vazio ou não é válido")
            raise ValueError("Invalid webhook payload")
        except stripe.error.SignatureVerificationError:
            logger.error("Assinatura do webhook inválida")
            raise ValueError("Invalid webhook signature")

    @staticmethod
    def handle_webhook_event(event: dict) -> dict:
        """Processar evento do webhook"""
        event_type = event["type"]
        data = event["data"]["object"]

        logger.info(f"Processando webhook: {event_type}")

        if event_type == "customer.subscription.updated":
            return {
                "type": "subscription_updated",
                "subscription_id": data["id"],
                "status": data["status"],
            }
        elif event_type == "customer.subscription.deleted":
            return {
                "type": "subscription_deleted",
                "subscription_id": data["id"],
            }
        elif event_type == "invoice.paid":
            return {
                "type": "invoice_paid",
                "invoice_id": data["id"],
                "customer_id": data["customer"],
                "amount": data["amount_paid"],
            }
        elif event_type == "invoice.payment_failed":
            return {
                "type": "invoice_payment_failed",
                "invoice_id": data["id"],
                "customer_id": data["customer"],
            }
        else:
            logger.warning(f"Evento não tratado: {event_type}")
            return {"type": "unhandled", "event_type": event_type}
