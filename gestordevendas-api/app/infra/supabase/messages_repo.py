"""
Repositório de Messages — Supabase.
Messages não têm account_id diretamente; o isolamento vem via conversation_id
que pertence ao account. O repositório valida isso recebendo account_id.
"""
from __future__ import annotations

import datetime
from typing import Optional
from uuid import UUID

import structlog

from app.core.supabase import get_supabase_admin
from app.domain.exceptions import NotFoundError

logger = structlog.get_logger(__name__)

TABLE = "messages"
SELECT = "*, profiles:sender_id(full_name)"


def _enrich(row: dict) -> dict:
    sender = row.pop("profiles", None) or {}
    row["sender_name"] = sender.get("full_name")
    return row


class MessagesRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    # ── Criação ───────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        conversation_id: UUID,
        content: Optional[str],
        message_type: str = "text",
        direction: str = "outbound",
        sender_id: Optional[UUID] = None,
        media_url: Optional[str] = None,
        wa_message_id: Optional[str] = None,
        status: str = "sent",
        template_name: Optional[str] = None,
        template_params: Optional[list[str]] = None,
        sent_by_ai: bool = False,
    ) -> dict:
        payload: dict = {
            "conversation_id": str(conversation_id),
            "content": content,
            "message_type": message_type,
            "direction": direction,
            "status": status,
            "sent_by_ai": sent_by_ai,
        }
        if sender_id:
            payload["sender_id"] = str(sender_id)
        if media_url:
            payload["media_url"] = media_url
        if wa_message_id:
            payload["wa_message_id"] = wa_message_id
        if template_name:
            payload["template_name"] = template_name
        if template_params:
            payload["template_params"] = template_params

        result = self._client.table(TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar mensagem.")
        return _enrich(result.data[0])

    # ── Leitura ───────────────────────────────────────────────────────────────

    def list_by_conversation(
        self,
        conversation_id: UUID,
        *,
        page: int = 1,
        per_page: int = 50,
        before: Optional[datetime.datetime] = None,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * per_page

        cq = (
            self._client.table(TABLE)
            .select("id", count="exact")
            .eq("conversation_id", str(conversation_id))
        )
        if before:
            cq = cq.lt("created_at", before.isoformat())
        total = (cq.execute().count) or 0

        dq = (
            self._client.table(TABLE)
            .select(SELECT)
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
        )
        if before:
            dq = dq.lt("created_at", before.isoformat())

        rows = dq.execute().data or []
        # Retorna em ordem cronológica (mais antiga primeiro)
        return [_enrich(r) for r in reversed(rows)], total

    def get_by_id(self, message_id: UUID) -> dict:
        result = (
            self._client.table(TABLE)
            .select(SELECT)
            .eq("id", str(message_id))
            .single()
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"Mensagem {message_id} não encontrada.")
        return _enrich(result.data)

    def update_status(self, wa_message_id: str, new_status: str) -> None:
        """Atualiza status de entrega pelo ID do WhatsApp (webhook de status)."""
        self._client.table(TABLE).update({"status": new_status}).eq(
            "wa_message_id", wa_message_id
        ).execute()

    def get_last_inbound(self, conversation_id: UUID) -> Optional[dict]:
        result = (
            self._client.table(TABLE)
            .select(SELECT)
            .eq("conversation_id", str(conversation_id))
            .eq("direction", "inbound")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return _enrich(result.data[0])
        return None
