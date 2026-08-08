"""
Repositório de Contacts — todas as queries vão ao Supabase via cliente admin.
O isolamento multi-tenant é feito SEMPRE filtrando por account_id (nunca
depende só do RLS, que é uma segunda linha de defesa).
"""
from __future__ import annotations

import math
from typing import Any, Optional
from uuid import UUID

import structlog

from app.core.supabase import get_supabase_admin
from app.domain.exceptions import ConflictError, NotFoundError, TenantIsolationError

logger = structlog.get_logger(__name__)

TABLE = "contacts"


def _row_to_dict(row: dict) -> dict:
    """Normaliza campos que o Supabase devolve como string quando deveriam ser outros tipos."""
    return row


class ContactsRepository:
    """
    Acesso à tabela `contacts` no Supabase.
    Todos os métodos exigem account_id explícito — jamais buscam sem ele.
    """

    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _base_query(self):
        return self._client.table(TABLE).select("*").eq("account_id", self._account_id)

    # ── Criação ───────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        name: str,
        phone: str,
        email: Optional[str] = None,
        avatar_url: Optional[str] = None,
        custom_attributes: Optional[dict] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        # Verifica duplicidade de telefone dentro do tenant
        existing = (
            self._client.table(TABLE)
            .select("id")
            .eq("account_id", self._account_id)
            .eq("phone", phone)
            .execute()
        )
        if existing.data:
            raise ConflictError(f"Já existe um contato com o telefone {phone} nesta conta.")

        payload: dict[str, Any] = {
            "account_id": self._account_id,
            "name": name,
            "phone": phone,
        }
        if email:
            payload["email"] = email
        if avatar_url:
            payload["avatar_url"] = avatar_url
        if custom_attributes:
            payload["custom_attributes"] = custom_attributes
        if tags:
            payload["tags"] = tags

        result = self._client.table(TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar contato — Supabase não retornou dados.")
        return _row_to_dict(result.data[0])

    # ── Leitura ───────────────────────────────────────────────────────────────

    def get_by_id(self, contact_id: UUID) -> dict:
        result = (
            self._base_query()
            .eq("id", str(contact_id))
            .single()
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"Contato {contact_id} não encontrado.")

        row = result.data
        # Segurança extra: verifica account_id (nunca deve divergir, mas se divergir é bug crítico)
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                expected=self._account_id,
                found=row.get("account_id"),
                contact_id=str(contact_id),
            )
            raise TenantIsolationError("Violação de isolamento de tenant em contacts.")
        return _row_to_dict(row)

    def list(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        search: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> tuple[list[dict], int]:
        """Retorna (items, total)."""
        offset = (page - 1) * per_page

        # Conta total (sem limit/offset)
        count_q = (
            self._client.table(TABLE)
            .select("id", count="exact")
            .eq("account_id", self._account_id)
        )
        if search:
            # ilike em nome OU telefone
            count_q = count_q.or_(
                f"name.ilike.%{search}%,phone.ilike.%{search}%"
            )
        if tag:
            count_q = count_q.contains("tags", [tag])

        count_result = count_q.execute()
        total = count_result.count or 0

        # Busca paginada
        data_q = self._base_query().order("name").range(offset, offset + per_page - 1)
        if search:
            data_q = data_q.or_(
                f"name.ilike.%{search}%,phone.ilike.%{search}%"
            )
        if tag:
            data_q = data_q.contains("tags", [tag])

        data_result = data_q.execute()
        items = [_row_to_dict(r) for r in (data_result.data or [])]
        return items, total

    def get_by_phone(self, phone: str) -> Optional[dict]:
        result = (
            self._base_query()
            .eq("phone", phone)
            .limit(1)
            .execute()
        )
        if result.data:
            return _row_to_dict(result.data[0])
        return None

    # ── Atualização ───────────────────────────────────────────────────────────

    def update(self, contact_id: UUID, data: dict) -> dict:
        # Confirma que o contato pertence ao tenant antes de atualizar
        self.get_by_id(contact_id)

        # Remove campos None para não sobrescrever com null indesejado
        payload = {k: v for k, v in data.items() if v is not None}
        if not payload:
            return self.get_by_id(contact_id)

        result = (
            self._client.table(TABLE)
            .update(payload)
            .eq("id", str(contact_id))
            .eq("account_id", self._account_id)   # double-check tenant
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"Contato {contact_id} não encontrado.")
        return _row_to_dict(result.data[0])

    # ── Remoção ───────────────────────────────────────────────────────────────

    def delete(self, contact_id: UUID) -> None:
        # Confirma existência + tenant antes de deletar
        self.get_by_id(contact_id)

        self._client.table(TABLE).delete().eq("id", str(contact_id)).eq(
            "account_id", self._account_id
        ).execute()
        logger.info("contact_deleted", contact_id=str(contact_id), account_id=self._account_id)
