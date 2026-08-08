"""
Repositório de Chatbot Flows e Flow Runs.

Schema esperado:
  chatbot_flows: id, account_id, name, description, trigger_keywords (JSONB array),
                 nodes (JSONB array), is_active, created_by, created_at, updated_at

  flow_runs: id, account_id, flow_id, conversation_id,
             current_node_index (int, default 0),
             status (running|completed|expired|error),
             error_reason (text, nullable),
             started_at, updated_at

Estrutura de um nó (nodes[]):
  { "type": "message",   "content": "Olá! Como posso ajudar?" }
  { "type": "condition", "conditions": [{"operator": "contains", "value": "sim"}] }
  { "type": "action",    "action_type": "assign_conversation", "agent_id": "..." }
  { "type": "action",    "action_type": "add_tag", "tag": "interessado" }
  { "type": "action",    "action_type": "close_conversation" }
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.core.supabase import get_supabase_admin
from app.domain.exceptions import ConflictError, NotFoundError, TenantIsolationError

logger = structlog.get_logger(__name__)

FLOWS_TABLE = "chatbot_flows"
RUNS_TABLE = "flow_runs"


class ChatbotFlowsRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _assert_tenant(self, row: dict, table: str = FLOWS_TABLE) -> None:
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=table,
                expected=self._account_id,
                found=row.get("account_id"),
            )
            raise TenantIsolationError(f"Violação de isolamento em {table}.")

    def _base(self):
        return (
            self._client.table(FLOWS_TABLE)
            .select("*")
            .eq("account_id", self._account_id)
        )

    # ── CRUD de Flows ──────────────────────────────────────────────────────────

    def create(
        self,
        *,
        name: str,
        nodes: list[dict],
        trigger_keywords: Optional[list[str]] = None,
        description: Optional[str] = None,
        is_active: bool = True,
        created_by: Optional[str] = None,
    ) -> dict:
        payload: dict = {
            "account_id": self._account_id,
            "name": name,
            "nodes": nodes,
            "trigger_keywords": [kw.lower().strip() for kw in (trigger_keywords or [])],
            "is_active": is_active,
        }
        if description:
            payload["description"] = description
        if created_by:
            payload["created_by"] = created_by

        result = self._client.table(FLOWS_TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar chatbot flow.")
        self._assert_tenant(result.data[0])
        return result.data[0]

    def get_by_id(self, flow_id: UUID) -> dict:
        result = self._base().eq("id", str(flow_id)).single().execute()
        if not result.data:
            raise NotFoundError(f"Flow {flow_id} não encontrado.")
        self._assert_tenant(result.data)
        return result.data

    def list(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        is_active: Optional[bool] = None,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * per_page

        cq = self._client.table(FLOWS_TABLE).select("id", count="exact").eq(
            "account_id", self._account_id
        )
        if is_active is not None:
            cq = cq.eq("is_active", is_active)
        total = (cq.execute().count) or 0

        dq = self._base().order("created_at", desc=True).range(offset, offset + per_page - 1)
        if is_active is not None:
            dq = dq.eq("is_active", is_active)

        return dq.execute().data or [], total

    def update(self, flow_id: UUID, updates: dict) -> dict:
        self.get_by_id(flow_id)
        allowed = {"name", "description", "nodes", "trigger_keywords", "is_active"}
        payload = {k: v for k, v in updates.items() if k in allowed}

        # Normaliza keywords para lowercase
        if "trigger_keywords" in payload:
            payload["trigger_keywords"] = [
                kw.lower().strip() for kw in (payload["trigger_keywords"] or [])
            ]

        if not payload:
            return self.get_by_id(flow_id)

        self._client.table(FLOWS_TABLE).update(payload).eq(
            "id", str(flow_id)
        ).eq("account_id", self._account_id).execute()
        return self.get_by_id(flow_id)

    def delete(self, flow_id: UUID) -> None:
        self.get_by_id(flow_id)
        self._client.table(FLOWS_TABLE).delete().eq(
            "id", str(flow_id)
        ).eq("account_id", self._account_id).execute()

    def get_active_flows(self) -> list[dict]:
        """Retorna todos os flows ativos do account (para matching de keyword)."""
        result = (
            self._base()
            .eq("is_active", True)
            .execute()
        )
        return result.data or []

    def find_matching_flow(self, message_text: str) -> Optional[dict]:
        """
        Retorna o primeiro flow ativo cujo trigger_keyword aparece na mensagem.
        Case-insensitive, busca substring.
        """
        text_lower = message_text.lower().strip()
        flows = self.get_active_flows()

        for flow in flows:
            keywords = flow.get("trigger_keywords") or []
            for kw in keywords:
                if kw and kw in text_lower:
                    return flow
        return None


class FlowRunsRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _assert_tenant(self, row: dict) -> None:
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=RUNS_TABLE,
                expected=self._account_id,
                found=row.get("account_id"),
            )
            raise TenantIsolationError("Violação de isolamento em flow_runs.")

    def create(self, *, flow_id: UUID, conversation_id: UUID) -> dict:
        payload = {
            "account_id": self._account_id,
            "flow_id": str(flow_id),
            "conversation_id": str(conversation_id),
            "current_node_index": 0,
            "status": "running",
        }
        result = self._client.table(RUNS_TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar flow_run.")
        self._assert_tenant(result.data[0])
        return result.data[0]

    def get_active_for_conversation(self, conversation_id: UUID) -> Optional[dict]:
        """Retorna o flow_run ativo para uma conversa, se existir."""
        result = (
            self._client.table(RUNS_TABLE)
            .select("*")
            .eq("account_id", self._account_id)
            .eq("conversation_id", str(conversation_id))
            .eq("status", "running")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        self._assert_tenant(result.data[0])
        return result.data[0]

    def get_by_id(self, run_id: UUID) -> dict:
        result = (
            self._client.table(RUNS_TABLE)
            .select("*")
            .eq("id", str(run_id))
            .eq("account_id", self._account_id)
            .single()
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"Flow run {run_id} não encontrado.")
        self._assert_tenant(result.data)
        return result.data

    def list_by_flow(
        self, flow_id: UUID, *, page: int = 1, per_page: int = 25
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * per_page
        total = (
            self._client.table(RUNS_TABLE)
            .select("id", count="exact")
            .eq("account_id", self._account_id)
            .eq("flow_id", str(flow_id))
            .execute()
            .count
        ) or 0
        items = (
            self._client.table(RUNS_TABLE)
            .select("*")
            .eq("account_id", self._account_id)
            .eq("flow_id", str(flow_id))
            .order("started_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
            .data
        ) or []
        return items, total
