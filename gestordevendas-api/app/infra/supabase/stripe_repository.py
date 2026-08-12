"""Stripe Repository - Persistência de dados Stripe no banco"""
from app.infra.supabase.client import get_supabase
import logging

logger = logging.getLogger(__name__)


class StripeRepository:
    """Repositório para dados Stripe no Supabase"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def save_stripe_customer(
        self, account_id: str, stripe_customer_id: str, billing_email: str, billing_name: str
    ) -> dict:
        """Salvar informações do cliente Stripe no banco"""
        try:
            result = self.supabase.table("stripe_customers").upsert(
                {
                    "account_id": account_id,
                    "stripe_customer_id": stripe_customer_id,
                    "billing_email": billing_email,
                    "billing_name": billing_name,
                }
            ).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Erro ao salvar cliente Stripe: {str(e)}")
            raise

    async def get_stripe_customer(self, account_id: str) -> dict:
        """Buscar cliente Stripe por account_id"""
        try:
            result = self.supabase.table("stripe_customers").select("*").eq(
                "account_id", account_id
            ).single().execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Erro ao buscar cliente Stripe: {str(e)}")
            return None

    async def save_subscription(
        self,
        account_id: str,
        stripe_subscription_id: str,
        plan_id: str,
        stripe_customer_id: str,
        status: str,
        current_period_start: int,
        current_period_end: int,
    ) -> dict:
        """Salvar subscrição no banco"""
        try:
            result = self.supabase.table("subscriptions").upsert(
                {
                    "account_id": account_id,
                    "stripe_subscription_id": stripe_subscription_id,
                    "plan_id": plan_id,
                    "stripe_customer_id": stripe_customer_id,
                    "status": status,
                    "current_period_start": current_period_start,
                    "current_period_end": current_period_end,
                }
            ).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Erro ao salvar subscrição: {str(e)}")
            raise

    async def get_subscription(self, account_id: str) -> dict:
        """Buscar subscrição ativa por account_id"""
        try:
            result = self.supabase.table("subscriptions").select("*").eq(
                "account_id", account_id
            ).eq("status", "active").single().execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Erro ao buscar subscrição: {str(e)}")
            return None

    async def save_invoice(
        self,
        account_id: str,
        stripe_invoice_id: str,
        amount_paid: int,
        amount_due: int,
        status: str,
        invoice_pdf_url: str,
    ) -> dict:
        """Salvar fatura no banco"""
        try:
            result = self.supabase.table("invoices").insert(
                {
                    "account_id": account_id,
                    "stripe_invoice_id": stripe_invoice_id,
                    "amount_paid": amount_paid,
                    "amount_due": amount_due,
                    "status": status,
                    "invoice_pdf_url": invoice_pdf_url,
                }
            ).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Erro ao salvar fatura: {str(e)}")
            raise

    async def list_invoices(self, account_id: str, limit: int = 20) -> list:
        """Listar faturas por account_id"""
        try:
            result = self.supabase.table("invoices").select("*").eq(
                "account_id", account_id
            ).order("created_at", desc=True).limit(limit).execute()
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Erro ao listar faturas: {str(e)}")
            return []

    async def update_subscription_status(
        self, stripe_subscription_id: str, status: str
    ) -> dict:
        """Atualizar status da subscrição"""
        try:
            result = self.supabase.table("subscriptions").update(
                {"status": status}
            ).eq("stripe_subscription_id", stripe_subscription_id).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Erro ao atualizar status da subscrição: {str(e)}")
            raise
