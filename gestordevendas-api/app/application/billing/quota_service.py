"""
Serviço de verificação de quotas por plano.

Uso:
    QuotaService(account_id).check("inboxes")   # lança PaymentRequiredError se no limite
    QuotaService(account_id).get_status()       # retorna uso atual vs limites do plano
"""
from __future__ import annotations

from uuid import UUID

import structlog

from app.domain.plans import get_plan
from app.infra.supabase.billing_repo import BillingRepository

logger = structlog.get_logger(__name__)


class PaymentRequiredError(Exception):
    """Lançado quando o account atingiu o limite do plano."""
    def __init__(self, resource: str, limit: int, current: int, plan: str):
        self.resource = resource
        self.limit = limit
        self.current = current
        self.plan = plan
        super().__init__(
            f"Limite do plano '{plan}' atingido para '{resource}': "
            f"{current}/{limit}. Faça upgrade para continuar."
        )


class QuotaService:
    def __init__(self, account_id: UUID):
        self._account_id = account_id
        self._repo = BillingRepository(account_id)
        self._account: dict | None = None
        self._usage: dict | None = None

    def _load(self) -> tuple[dict, dict]:
        if self._account is None:
            try:
                self._account = self._repo.get_account()
            except Exception:
                # Account pode não ter tabela de billing ainda — assume free
                self._account = {"plan": "free", "subscription_status": "active"}
        if self._usage is None:
            try:
                self._usage = self._repo.get_usage()
            except Exception:
                self._usage = {"conversations_count": 0, "broadcasts_count": 0}
        return self._account, self._usage

    def check(self, resource: str) -> None:
        """
        Verifica se criar mais um recurso do tipo especificado está dentro do plano.
        Lança PaymentRequiredError se o limite foi atingido.

        Recursos suportados:
          inboxes, contacts, agents, conversations, broadcasts, flows, kb_entries, ai, broadcasts_feature
        """
        account, usage = self._load()
        plan_name = account.get("plan", "free")
        limits = get_plan(plan_name)

        # Verifica se a subscription está ativa (past_due pode ainda usar, canceled não)
        sub_status = account.get("subscription_status", "active")
        if sub_status == "canceled":
            raise PaymentRequiredError(resource, 0, 1, plan_name)

        def _check_limit(limit_val, current_fn):
            if limit_val is None:
                return  # ilimitado
            current = current_fn()
            if current >= limit_val:
                raise PaymentRequiredError(resource, limit_val, current, plan_name)

        if resource == "inboxes":
            _check_limit(limits.max_inboxes, self._repo.count_inboxes)

        elif resource == "contacts":
            _check_limit(limits.max_contacts, self._repo.count_contacts)

        elif resource == "agents":
            _check_limit(limits.max_agents, self._repo.count_agents)

        elif resource == "conversations":
            if limits.max_conversations_per_month is not None:
                current = usage.get("conversations_count", 0) or 0
                if current >= limits.max_conversations_per_month:
                    raise PaymentRequiredError(
                        resource, limits.max_conversations_per_month, current, plan_name
                    )

        elif resource == "broadcasts":
            if not limits.broadcasts_enabled:
                raise PaymentRequiredError(resource, 0, 1, plan_name)
            if limits.max_broadcasts_per_month is not None:
                current = usage.get("broadcasts_count", 0) or 0
                if current >= limits.max_broadcasts_per_month:
                    raise PaymentRequiredError(
                        resource, limits.max_broadcasts_per_month, current, plan_name
                    )

        elif resource == "flows":
            if not limits.flows_enabled:
                raise PaymentRequiredError(resource, 0, 1, plan_name)
            _check_limit(limits.max_flows, self._repo.count_active_flows)

        elif resource == "kb_entries":
            _check_limit(limits.max_kb_entries, self._repo.count_kb_entries)

        elif resource == "ai":
            if not limits.ai_enabled:
                raise PaymentRequiredError(resource, 0, 1, plan_name)

    def get_status(self) -> dict:
        """Retorna uso atual e limites do plano para exibir no dashboard."""
        account, usage = self._load()
        plan_name = account.get("plan", "free")
        limits = get_plan(plan_name)

        def _fmt(current_fn, limit_val):
            try:
                current = current_fn()
            except Exception:
                current = 0
            return {"current": current, "limit": limit_val, "unlimited": limit_val is None}

        return {
            "plan": plan_name,
            "subscription_status": account.get("subscription_status", "active"),
            "stripe_subscription_id": account.get("stripe_subscription_id"),
            "limits": {
                "inboxes": _fmt(self._repo.count_inboxes, limits.max_inboxes),
                "contacts": _fmt(self._repo.count_contacts, limits.max_contacts),
                "agents": _fmt(self._repo.count_agents, limits.max_agents),
                "conversations_this_month": {
                    "current": usage.get("conversations_count", 0) or 0,
                    "limit": limits.max_conversations_per_month,
                    "unlimited": limits.max_conversations_per_month is None,
                },
                "broadcasts_this_month": {
                    "current": usage.get("broadcasts_count", 0) or 0,
                    "limit": limits.max_broadcasts_per_month,
                    "unlimited": limits.max_broadcasts_per_month is None,
                },
                "flows": _fmt(self._repo.count_active_flows, limits.max_flows),
                "kb_entries": _fmt(self._repo.count_kb_entries, limits.max_kb_entries),
            },
            "features": {
                "ai_enabled": limits.ai_enabled,
                "broadcasts_enabled": limits.broadcasts_enabled,
                "flows_enabled": limits.flows_enabled,
            },
        }
