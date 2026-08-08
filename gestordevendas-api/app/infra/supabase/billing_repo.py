"""
Repositório de Billing — subscription e uso mensal por account.

Schema esperado:
  accounts: id, name, plan (free|pro|enterprise), stripe_customer_id,
            stripe_subscription_id, subscription_status
            (active|trialing|past_due|canceled|unpaid),
            trial_ends_at, created_at, updated_at

  usage_counters: id, account_id, period (YYYY-MM), conversations_count,
                  broadcasts_count, created_at, updated_at
  (upsert automático — sem necessidade de criar manualmente)
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID
import datetime

import structlog

from app.core.supabase import get_supabase_admin
from app.domain.exceptions import NotFoundError, TenantIsolationError
from app.domain.plans import DEFAULT_PLAN

logger = structlog.get_logger(__name__)

ACCOUNTS_TABLE = "accounts"
USAGE_TABLE = "usage_counters"


class BillingRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _assert_tenant(self, row: dict) -> None:
        if str(row.get("id", "")) != self._account_id and \
           str(row.get("account_id", "")) != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=ACCOUNTS_TABLE,
                expected=self._account_id,
                found=row,
            )
            raise TenantIsolationError("Violação de isolamento em accounts.")

    # ── Account / Subscription ─────────────────────────────────────────────────

    def get_account(self) -> dict:
        result = (
            self._client.table(ACCOUNTS_TABLE)
            .select("*")
            .eq("id", self._account_id)
            .single()
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"Account {self._account_id} não encontrado.")
        return result.data

    def update_subscription(
        self,
        *,
        plan: Optional[str] = None,
        stripe_customer_id: Optional[str] = None,
        stripe_subscription_id: Optional[str] = None,
        subscription_status: Optional[str] = None,
        trial_ends_at: Optional[str] = None,
    ) -> dict:
        payload: dict = {}
        if plan is not None:
            payload["plan"] = plan
        if stripe_customer_id is not None:
            payload["stripe_customer_id"] = stripe_customer_id
        if stripe_subscription_id is not None:
            payload["stripe_subscription_id"] = stripe_subscription_id
        if subscription_status is not None:
            payload["subscription_status"] = subscription_status
        if trial_ends_at is not None:
            payload["trial_ends_at"] = trial_ends_at

        if not payload:
            return self.get_account()

        self._client.table(ACCOUNTS_TABLE).update(payload).eq(
            "id", self._account_id
        ).execute()
        return self.get_account()

    # ── Uso mensal ─────────────────────────────────────────────────────────────

    @staticmethod
    def _current_period() -> str:
        return datetime.date.today().strftime("%Y-%m")

    def get_usage(self, period: Optional[str] = None) -> dict:
        period = period or self._current_period()
        result = (
            self._client.table(USAGE_TABLE)
            .select("*")
            .eq("account_id", self._account_id)
            .eq("period", period)
            .execute()
        )
        if not result.data:
            return {
                "account_id": self._account_id,
                "period": period,
                "conversations_count": 0,
                "broadcasts_count": 0,
            }
        return result.data[0]

    def increment_usage(self, *, field: str, amount: int = 1) -> dict:
        """
        Incrementa um contador de uso do período atual.
        Faz upsert automático se o registro ainda não existir.
        """
        period = self._current_period()
        current = self.get_usage(period)
        current_value = current.get(field, 0) or 0
        new_value = current_value + amount

        if current.get("id"):
            # Atualiza registro existente
            self._client.table(USAGE_TABLE).update(
                {field: new_value}
            ).eq("id", current["id"]).execute()
        else:
            # Cria novo registro para o período
            self._client.table(USAGE_TABLE).insert({
                "account_id": self._account_id,
                "period": period,
                field: new_value,
            }).execute()

        return self.get_usage(period)

    # ── Contagens para verificação de quotas ──────────────────────────────────

    def count_inboxes(self) -> int:
        result = (
            self._client.table("inboxes")
            .select("id", count="exact")
            .eq("account_id", self._account_id)
            .execute()
        )
        return result.count or 0

    def count_contacts(self) -> int:
        result = (
            self._client.table("contacts")
            .select("id", count="exact")
            .eq("account_id", self._account_id)
            .execute()
        )
        return result.count or 0

    def count_agents(self) -> int:
        result = (
            self._client.table("profiles")
            .select("id", count="exact")
            .eq("account_id", self._account_id)
            .execute()
        )
        return result.count or 0

    def count_active_flows(self) -> int:
        result = (
            self._client.table("chatbot_flows")
            .select("id", count="exact")
            .eq("account_id", self._account_id)
            .eq("is_active", True)
            .execute()
        )
        return result.count or 0

    def count_kb_entries(self) -> int:
        result = (
            self._client.table("ai_knowledge_entries")
            .select("id", count="exact")
            .eq("account_id", self._account_id)
            .execute()
        )
        return result.count or 0
