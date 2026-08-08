"""
Repositório de Inboxes (contas WhatsApp Business).
O access_token é armazenado CRIPTOGRAFADO (Fernet AES-256-GCM).
NUNCA retornar o token descriptografado para fora da camada infra.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.core.encryption import decrypt, encrypt
from app.core.supabase import get_supabase_admin
from app.domain.exceptions import ConflictError, NotFoundError, TenantIsolationError

logger = structlog.get_logger(__name__)

TABLE = "inboxes"


def _sanitize(row: dict) -> dict:
    """Remove campos sensíveis antes de retornar ao caller."""
    row.pop("encrypted_access_token", None)
    return row


class InboxesRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _base(self):
        return self._client.table(TABLE).select(
            "id, account_id, name, phone_number_id, display_phone_number, "
            "verified_name, webhook_verify_token, webhook_verified, is_active, created_at, updated_at"
            # encrypted_access_token NÃO incluído no select padrão
        ).eq("account_id", self._account_id)

    def _assert_tenant(self, row: dict, inbox_id) -> None:
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=TABLE,
                expected=self._account_id,
                found=row.get("account_id"),
                id=str(inbox_id),
            )
            raise TenantIsolationError("Violação de isolamento de tenant em inboxes.")

    # ── Criação ───────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        name: str,
        phone_number_id: str,
        access_token: str,           # recebido em texto puro, guardado criptografado
        display_phone_number: Optional[str] = None,
        verified_name: Optional[str] = None,
        webhook_verify_token: Optional[str] = None,
    ) -> dict:
        # Unicidade: phone_number_id dentro do tenant
        existing = (
            self._client.table(TABLE)
            .select("id")
            .eq("account_id", self._account_id)
            .eq("phone_number_id", phone_number_id)
            .execute()
        )
        if existing.data:
            raise ConflictError(f"Já existe uma inbox com phone_number_id {phone_number_id}.")

        encrypted = encrypt(access_token)
        payload = {
            "account_id": self._account_id,
            "name": name,
            "phone_number_id": phone_number_id,
            "encrypted_access_token": encrypted,
            "is_active": True,
        }
        if display_phone_number:
            payload["display_phone_number"] = display_phone_number
        if verified_name:
            payload["verified_name"] = verified_name
        if webhook_verify_token:
            payload["webhook_verify_token"] = webhook_verify_token

        result = self._client.table(TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar inbox.")
        return _sanitize(result.data[0])

    # ── Leitura ───────────────────────────────────────────────────────────────

    def get_by_id(self, inbox_id: UUID) -> dict:
        result = self._base().eq("id", str(inbox_id)).single().execute()
        if not result.data:
            raise NotFoundError(f"Inbox {inbox_id} não encontrada.")
        self._assert_tenant(result.data, inbox_id)
        return result.data

    def list(self) -> list[dict]:
        result = self._base().order("name").execute()
        return result.data or []

    def get_by_phone_number_id(self, phone_number_id: str) -> Optional[dict]:
        """Usado pelo webhook: encontra a inbox pelo phone_number_id do payload."""
        result = (
            self._client.table(TABLE)
            .select("id, account_id, name, phone_number_id, is_active")
            .eq("phone_number_id", phone_number_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def get_decrypted_token(self, inbox_id: UUID) -> str:
        """
        Retorna o access_token em texto puro para uso interno (envio de mensagem).
        NUNCA expor este valor fora da camada de aplicação/workers.
        """
        result = (
            self._client.table(TABLE)
            .select("encrypted_access_token, account_id")
            .eq("id", str(inbox_id))
            .single()
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"Inbox {inbox_id} não encontrada.")
        self._assert_tenant(result.data, inbox_id)
        return decrypt(result.data["encrypted_access_token"])

    # ── Atualização ───────────────────────────────────────────────────────────

    def update(self, inbox_id: UUID, data: dict) -> dict:
        self.get_by_id(inbox_id)

        # Se vier novo access_token, criptografa antes de salvar
        if "access_token" in data:
            data["encrypted_access_token"] = encrypt(data.pop("access_token"))

        payload = {k: v for k, v in data.items() if v is not None}
        self._client.table(TABLE).update(payload).eq("id", str(inbox_id)).eq(
            "account_id", self._account_id
        ).execute()
        return self.get_by_id(inbox_id)

    def set_active(self, inbox_id: UUID, active: bool) -> dict:
        self.get_by_id(inbox_id)
        self._client.table(TABLE).update({"is_active": active}).eq(
            "id", str(inbox_id)
        ).eq("account_id", self._account_id).execute()
        return self.get_by_id(inbox_id)

    # ── Remoção ───────────────────────────────────────────────────────────────

    def delete(self, inbox_id: UUID) -> None:
        self.get_by_id(inbox_id)
        self._client.table(TABLE).delete().eq("id", str(inbox_id)).eq(
            "account_id", self._account_id
        ).execute()
