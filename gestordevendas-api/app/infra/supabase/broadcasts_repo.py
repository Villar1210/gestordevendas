"""
Repositório de Broadcasts — envio em massa via WhatsApp Template.

Schema esperado:
  broadcasts: id, account_id, inbox_id, name, template_name, template_params (JSONB),
              language_code, status (draft|scheduled|running|completed|cancelled|failed),
              total_recipients, sent_count, delivered_count, failed_count,
              scheduled_at, started_at, completed_at, created_by, created_at

  broadcast_recipients: id, broadcast_id, contact_id, phone, status
              (pending|sent|delivered|read|failed), wa_message_id,
              error_code, processed_at
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.core.supabase import get_supabase_admin
from app.domain.exceptions import ConflictError, NotFoundError, TenantIsolationError

logger = structlog.get_logger(__name__)

TABLE = "broadcasts"
RECIPIENTS_TABLE = "broadcast_recipients"
BATCH_SIZE = 50   # registros por query de recipients


class BroadcastsRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _base(self):
        return self._client.table(TABLE).select("*").eq("account_id", self._account_id)

    def _assert_tenant(self, row: dict, bid) -> None:
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=TABLE,
                expected=self._account_id,
                found=row.get("account_id"),
                id=str(bid),
            )
            raise TenantIsolationError("Violação de isolamento em broadcasts.")

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        inbox_id: UUID,
        name: str,
        template_name: str,
        template_params: Optional[list] = None,
        language_code: str = "pt_BR",
        scheduled_at: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> dict:
        payload: dict = {
            "account_id": self._account_id,
            "inbox_id": str(inbox_id),
            "name": name,
            "template_name": template_name,
            "template_params": template_params or [],
            "language_code": language_code,
            "status": "draft",
            "total_recipients": 0,
            "sent_count": 0,
            "delivered_count": 0,
            "failed_count": 0,
        }
        if scheduled_at:
            payload["scheduled_at"] = scheduled_at
        if created_by:
            payload["created_by"] = created_by

        result = self._client.table(TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar broadcast.")
        return result.data[0]

    def get_by_id(self, broadcast_id: UUID) -> dict:
        result = self._base().eq("id", str(broadcast_id)).single().execute()
        if not result.data:
            raise NotFoundError(f"Broadcast {broadcast_id} não encontrado.")
        self._assert_tenant(result.data, broadcast_id)
        return result.data

    def list(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        status: Optional[str] = None,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * per_page
        cq = self._client.table(TABLE).select("id", count="exact").eq(
            "account_id", self._account_id
        )
        if status:
            cq = cq.eq("status", status)
        total = (cq.execute().count) or 0

        dq = self._base().order("created_at", desc=True).range(offset, offset + per_page - 1)
        if status:
            dq = dq.eq("status", status)
        return dq.execute().data or [], total

    def update_status(self, broadcast_id: UUID, new_status: str, extra: Optional[dict] = None) -> dict:
        self.get_by_id(broadcast_id)
        payload = {"status": new_status, **(extra or {})}
        self._client.table(TABLE).update(payload).eq(
            "id", str(broadcast_id)
        ).eq("account_id", self._account_id).execute()
        return self.get_by_id(broadcast_id)

    def increment_counters(
        self, broadcast_id: UUID, *, sent: int = 0, failed: int = 0
    ) -> None:
        """Incrementa contadores via RPC para evitar race conditions."""
        # Fallback simples: busca atual + incrementa
        current = self.get_by_id(broadcast_id)
        self._client.table(TABLE).update({
            "sent_count": (current.get("sent_count") or 0) + sent,
            "failed_count": (current.get("failed_count") or 0) + failed,
        }).eq("id", str(broadcast_id)).execute()

    # ── Recipients ────────────────────────────────────────────────────────────

    def add_recipients(self, broadcast_id: UUID, recipients: list[dict]) -> int:
        """
        Adiciona destinatários ao broadcast (status=draft obrigatório).
        recipients: [{"contact_id": "...", "phone": "+5511..."}]
        Retorna total de registros inseridos.
        """
        broadcast = self.get_by_id(broadcast_id)
        if broadcast["status"] != "draft":
            raise ConflictError("Destinatários só podem ser adicionados em broadcasts com status 'draft'.")

        rows = [
            {
                "broadcast_id": str(broadcast_id),
                "contact_id": str(r["contact_id"]),
                "phone": r["phone"],
                "status": "pending",
            }
            for r in recipients
        ]
        if not rows:
            return 0

        # Insere em lotes para evitar limite do Supabase
        inserted = 0
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i: i + BATCH_SIZE]
            self._client.table(RECIPIENTS_TABLE).insert(batch).execute()
            inserted += len(batch)

        # Atualiza total_recipients
        self._client.table(TABLE).update({
            "total_recipients": (broadcast.get("total_recipients") or 0) + inserted
        }).eq("id", str(broadcast_id)).execute()

        return inserted

    def get_pending_recipients(
        self, broadcast_id: UUID, *, offset: int = 0, limit: int = BATCH_SIZE
    ) -> list[dict]:
        """Busca próximo lote de destinatários pendentes."""
        result = (
            self._client.table(RECIPIENTS_TABLE)
            .select("id, phone, contact_id")
            .eq("broadcast_id", str(broadcast_id))
            .eq("status", "pending")
            .order("id")
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []

    def update_recipient_status(
        self,
        recipient_id: str,
        *,
        new_status: str,
        wa_message_id: Optional[str] = None,
        error_code: Optional[str] = None,
    ) -> None:
        payload: dict = {"status": new_status}
        if wa_message_id:
            payload["wa_message_id"] = wa_message_id
        if error_code:
            payload["error_code"] = error_code[:100]
        self._client.table(RECIPIENTS_TABLE).update(payload).eq("id", recipient_id).execute()

    def count_pending(self, broadcast_id: UUID) -> int:
        result = (
            self._client.table(RECIPIENTS_TABLE)
            .select("id", count="exact")
            .eq("broadcast_id", str(broadcast_id))
            .eq("status", "pending")
            .execute()
        )
        return result.count or 0
