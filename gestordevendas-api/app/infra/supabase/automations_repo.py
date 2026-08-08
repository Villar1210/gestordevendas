"""
Repositório de Automations — Supabase, isolado por account_id.

Schema esperado (tabela `automations`):
  id, account_id, name, description, is_active,
  trigger_event (TEXT), conditions (JSONB), actions (JSONB[]),
  created_at, updated_at

Schema esperado (tabela `automation_executions` — log de execuções):
  id, automation_id, account_id, entity_id, entity_type,
  status (success|failed|skipped), error_message, executed_at
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.core.supabase import get_supabase_admin
from app.domain.exceptions import NotFoundError, TenantIsolationError

logger = structlog.get_logger(__name__)

TABLE = "automations"
LOG_TABLE = "automation_executions"


class AutomationsRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _base(self):
        return (
            self._client.table(TABLE)
            .select("*")
            .eq("account_id", self._account_id)
        )

    def _assert_tenant(self, row: dict, auto_id) -> None:
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=TABLE,
                expected=self._account_id,
                found=row.get("account_id"),
                id=str(auto_id),
            )
            raise TenantIsolationError("Violação de isolamento em automations.")

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        name: str,
        trigger_event: str,
        conditions: Optional[dict] = None,
        actions: list[dict],
        description: Optional[str] = None,
        is_active: bool = True,
    ) -> dict:
        payload = {
            "account_id": self._account_id,
            "name": name,
            "trigger_event": trigger_event,
            "conditions": conditions or {},
            "actions": actions,
            "is_active": is_active,
        }
        if description:
            payload["description"] = description
        result = self._client.table(TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar automação.")
        return result.data[0]

    def get_by_id(self, automation_id: UUID) -> dict:
        result = self._base().eq("id", str(automation_id)).single().execute()
        if not result.data:
            raise NotFoundError(f"Automação {automation_id} não encontrada.")
        self._assert_tenant(result.data, automation_id)
        return result.data

    def list(
        self,
        *,
        is_active: Optional[bool] = None,
        trigger_event: Optional[str] = None,
    ) -> list[dict]:
        q = self._base().order("name")
        if is_active is not None:
            q = q.eq("is_active", is_active)
        if trigger_event:
            q = q.eq("trigger_event", trigger_event)
        return q.execute().data or []

    def get_active_for_event(self, trigger_event: str) -> list[dict]:
        """Usado pelo engine: busca automações ativas para um evento específico."""
        return self.list(is_active=True, trigger_event=trigger_event)

    def update(self, automation_id: UUID, data: dict) -> dict:
        self.get_by_id(automation_id)
        payload = {k: v for k, v in data.items() if v is not None}
        self._client.table(TABLE).update(payload).eq(
            "id", str(automation_id)
        ).eq("account_id", self._account_id).execute()
        return self.get_by_id(automation_id)

    def delete(self, automation_id: UUID) -> None:
        self.get_by_id(automation_id)
        self._client.table(TABLE).delete().eq(
            "id", str(automation_id)
        ).eq("account_id", self._account_id).execute()

    # ── Log de execuções ──────────────────────────────────────────────────────

    def log_execution(
        self,
        *,
        automation_id: UUID,
        entity_id: str,
        entity_type: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> None:
        self._client.table(LOG_TABLE).insert({
            "automation_id": str(automation_id),
            "account_id": self._account_id,
            "entity_id": entity_id,
            "entity_type": entity_type,
            "status": status,
            "error_message": error_message,
        }).execute()

    def list_executions(
        self,
        automation_id: UUID,
        *,
        limit: int = 50,
    ) -> list[dict]:
        self.get_by_id(automation_id)
        result = (
            self._client.table(LOG_TABLE)
            .select("*")
            .eq("automation_id", str(automation_id))
            .eq("account_id", self._account_id)
            .order("executed_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
