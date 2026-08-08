"""
Repositório de Conversations — Supabase, isolado por account_id.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.core.supabase import get_supabase_admin
from app.domain.exceptions import NotFoundError, TenantIsolationError

logger = structlog.get_logger(__name__)

TABLE = "conversations"
# Campos + joins com contacts, inboxes e profiles (assignee)
# O frontend espera objetos aninhados: contact{}, inbox{}, assignee{}
SELECT = (
    "*, "
    "contacts(id, name, phone, email, tags, custom_attributes, created_at), "
    "inboxes:inbox_id(id, name, phone_number_id, is_active), "
    "profiles:assignee_id(id, full_name, avatar_url)"
)


def _enrich(row: dict) -> dict:
    """
    Transforma os joins do Supabase em objetos aninhados compatíveis com
    o contrato de API esperado pelo frontend.

    Mantém também os campos legados (contact_id, inbox_id, assignee_id) para
    não quebrar lógica interna que os usa.
    """
    raw_contact  = row.pop("contacts",  None) or {}
    raw_inbox    = row.pop("inboxes",   None) or {}
    raw_assignee = row.pop("profiles",  None) or {}

    # ── contact (nested) ──
    row["contact"] = {
        "id":            raw_contact.get("id"),
        "account_id":    row.get("account_id"),   # mesmo tenant
        "name":          raw_contact.get("name") or "",
        "phone":         raw_contact.get("phone") or "",
        "email":         raw_contact.get("email"),
        "tags":          raw_contact.get("tags") or [],
        # normaliza: no DB é custom_attributes, no frontend é custom_fields
        "custom_fields": raw_contact.get("custom_attributes") or {},
        "created_at":    raw_contact.get("created_at"),
        "updated_at":    raw_contact.get("created_at"),   # melhor que None
    } if raw_contact.get("id") else None

    # ── inbox (nested) ──
    row["inbox"] = {
        "id":              raw_inbox.get("id"),
        "account_id":      row.get("account_id"),
        "name":            raw_inbox.get("name") or "",
        "phone_number_id": raw_inbox.get("phone_number_id") or "",
        "is_active":       raw_inbox.get("is_active", True),
    } if raw_inbox.get("id") else None

    # ── assignee (nested) ──
    row["assignee"] = {
        "id":         raw_assignee.get("id"),
        "full_name":  raw_assignee.get("full_name"),
        "avatar_url": raw_assignee.get("avatar_url"),
        "email":      None,   # não vem do join — ok para exibição
    } if raw_assignee.get("id") else None

    # ── last_message: frontend usa last_message.content para preview ──
    preview = row.get("last_message_preview")
    row["last_message"] = {"content": preview} if preview else None

    return row


class ConversationsRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _base(self):
        return (
            self._client.table(TABLE)
            .select(SELECT)
            .eq("account_id", self._account_id)
        )

    def _assert_tenant(self, row: dict, conversation_id) -> None:
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=TABLE,
                expected=self._account_id,
                found=row.get("account_id"),
                id=str(conversation_id),
            )
            raise TenantIsolationError("Violação de isolamento de tenant em conversations.")

    # ── Criação ───────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        contact_id: UUID,
        inbox_id: UUID,
        assignee_id: Optional[UUID] = None,
    ) -> dict:
        payload = {
            "account_id": self._account_id,
            "contact_id": str(contact_id),
            "inbox_id": str(inbox_id),
            "status": "open",
            "ai_enabled": False,
            "unread_count": 0,
        }
        if assignee_id:
            payload["assignee_id"] = str(assignee_id)

        result = self._client.table(TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar conversa.")
        return _enrich(result.data[0])

    # ── Leitura ───────────────────────────────────────────────────────────────

    def get_by_id(self, conversation_id: UUID) -> dict:
        result = (
            self._base()
            .eq("id", str(conversation_id))
            .single()
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"Conversa {conversation_id} não encontrada.")
        self._assert_tenant(result.data, conversation_id)
        return _enrich(result.data)

    def list(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        status: Optional[str] = None,
        assignee_id: Optional[UUID] = None,
        contact_id: Optional[UUID] = None,
        search: Optional[str] = None,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * per_page

        # Supabase não suporta ilike em colunas de joins na query principal.
        # Resolve o search buscando IDs de contatos correspondentes primeiro.
        contact_ids_filter: Optional[list[str]] = None
        if search:
            c_result = (
                self._client.table("contacts")
                .select("id")
                .eq("account_id", self._account_id)
                .or_(f"name.ilike.%{search}%,phone.ilike.%{search}%")
                .execute()
            )
            matching = [r["id"] for r in (c_result.data or [])]
            if not matching:
                return [], 0  # nenhum contato encontrado — resultado vazio
            contact_ids_filter = matching

        # Count
        cq = (
            self._client.table(TABLE)
            .select("id", count="exact")
            .eq("account_id", self._account_id)
        )
        if status:
            cq = cq.eq("status", status)
        if assignee_id:
            cq = cq.eq("assignee_id", str(assignee_id))
        if contact_id:
            cq = cq.eq("contact_id", str(contact_id))
        if contact_ids_filter is not None:
            cq = cq.in_("contact_id", contact_ids_filter)

        total = (cq.execute().count) or 0

        # Data
        dq = self._base().order("last_message_at", desc=True).range(offset, offset + per_page - 1)
        if status:
            dq = dq.eq("status", status)
        if assignee_id:
            dq = dq.eq("assignee_id", str(assignee_id))
        if contact_id:
            dq = dq.eq("contact_id", str(contact_id))
        if contact_ids_filter is not None:
            dq = dq.in_("contact_id", contact_ids_filter)

        rows = dq.execute().data or []
        return [_enrich(r) for r in rows], total

    def get_by_wa_id(self, wa_conversation_id: str) -> Optional[dict]:
        """Busca por ID de conversa do WhatsApp (campo wa_conversation_id)."""
        result = (
            self._base()
            .eq("wa_conversation_id", wa_conversation_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return _enrich(result.data[0])
        return None

    # ── Ações de ciclo de vida ────────────────────────────────────────────────

    def _update_status(self, conversation_id: UUID, status: str, extra: dict | None = None) -> dict:
        self.get_by_id(conversation_id)  # valida tenant + existência
        payload = {"status": status, **(extra or {})}
        result = (
            self._client.table(TABLE)
            .update(payload)
            .eq("id", str(conversation_id))
            .eq("account_id", self._account_id)
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"Conversa {conversation_id} não encontrada.")
        return self.get_by_id(conversation_id)  # re-fetch com joins

    def assign(self, conversation_id: UUID, assignee_id: Optional[UUID]) -> dict:
        self.get_by_id(conversation_id)
        payload: dict = {"assignee_id": str(assignee_id) if assignee_id else None}
        self._client.table(TABLE).update(payload).eq("id", str(conversation_id)).eq(
            "account_id", self._account_id
        ).execute()
        return self.get_by_id(conversation_id)

    def close(self, conversation_id: UUID) -> dict:
        return self._update_status(conversation_id, "resolved")

    def reopen(self, conversation_id: UUID) -> dict:
        return self._update_status(conversation_id, "open")

    def toggle_ai(self, conversation_id: UUID, enabled: bool) -> dict:
        self.get_by_id(conversation_id)
        self._client.table(TABLE).update({"ai_enabled": enabled}).eq(
            "id", str(conversation_id)
        ).eq("account_id", self._account_id).execute()
        return self.get_by_id(conversation_id)

    def mark_message_received(
        self,
        conversation_id: UUID,
        *,
        preview: str,
    ) -> None:
        """Atualiza last_message_at e incrementa unread_count."""
        import datetime

        self._client.table(TABLE).update(
            {
                "last_message_at": datetime.datetime.utcnow().isoformat(),
                "last_message_preview": preview[:200],
            }
        ).eq("id", str(conversation_id)).eq("account_id", self._account_id).execute()
