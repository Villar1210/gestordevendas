"""
Repositório de AI Config — chave criptografada por account.

Schema esperado:
  ai_configs: id, account_id, provider (openai|anthropic),
              encrypted_api_key (Fernet AES-256-GCM, NUNCA retornada),
              model, max_tokens, temperature, system_prompt,
              is_active, created_at, updated_at

SEGURANÇA: encrypted_api_key é removida de TODOS os retornos via _sanitize().
           Apenas get_decrypted_key() acessa o valor real, para uso interno.
           NUNCA retornar a chave descriptografada ao cliente.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.core.encryption import decrypt, encrypt
from app.core.supabase import get_supabase_admin
from app.domain.exceptions import NotFoundError, TenantIsolationError

logger = structlog.get_logger(__name__)

TABLE = "ai_configs"


class AIConfigRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _sanitize(self, row: dict) -> dict:
        """Remove encrypted_api_key antes de retornar ao caller."""
        row = dict(row)
        row.pop("encrypted_api_key", None)
        return row

    def _assert_tenant(self, row: dict) -> None:
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=TABLE,
                expected=self._account_id,
                found=row.get("account_id"),
            )
            raise TenantIsolationError("Violação de isolamento em ai_configs.")

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def upsert(
        self,
        *,
        provider: str,
        api_key: str,
        model: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
        is_active: bool = True,
    ) -> dict:
        """
        Cria ou atualiza a configuração de AI do account.
        A api_key é criptografada antes de ser persistida.
        Retorna o registro SEM a chave criptografada.
        """
        encrypted = encrypt(api_key)
        payload = {
            "account_id": self._account_id,
            "provider": provider,
            "encrypted_api_key": encrypted,
            "is_active": is_active,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if model:
            payload["model"] = model
        if system_prompt is not None:
            payload["system_prompt"] = system_prompt

        # Tenta encontrar registro existente
        existing = (
            self._client.table(TABLE)
            .select("id")
            .eq("account_id", self._account_id)
            .eq("provider", provider)
            .execute()
        )

        if existing.data:
            row_id = existing.data[0]["id"]
            result = (
                self._client.table(TABLE)
                .update(payload)
                .eq("id", row_id)
                .execute()
            )
        else:
            result = self._client.table(TABLE).insert(payload).execute()

        if not result.data:
            raise RuntimeError("Falha ao salvar AI config.")

        self._assert_tenant(result.data[0])
        return self._sanitize(result.data[0])

    def get_active(self) -> Optional[dict]:
        """Retorna a config AI ativa do account (sem a chave criptografada)."""
        result = (
            self._client.table(TABLE)
            .select("*")
            .eq("account_id", self._account_id)
            .eq("is_active", True)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        self._assert_tenant(result.data[0])
        return self._sanitize(result.data[0])

    def get_by_provider(self, provider: str) -> Optional[dict]:
        """Retorna config por provider (sem a chave)."""
        result = (
            self._client.table(TABLE)
            .select("*")
            .eq("account_id", self._account_id)
            .eq("provider", provider)
            .execute()
        )
        if not result.data:
            return None
        self._assert_tenant(result.data[0])
        return self._sanitize(result.data[0])

    def list_all(self) -> list[dict]:
        """Lista todas as configs do account (sem chaves)."""
        result = (
            self._client.table(TABLE)
            .select("*")
            .eq("account_id", self._account_id)
            .order("provider")
            .execute()
        )
        rows = result.data or []
        for r in rows:
            self._assert_tenant(r)
        return [self._sanitize(r) for r in rows]

    def delete(self, provider: str) -> None:
        """Remove a config de um provider específico."""
        self.get_by_provider(provider)  # valida tenant + existência
        self._client.table(TABLE).delete().eq(
            "account_id", self._account_id
        ).eq("provider", provider).execute()

    # ── Acesso interno à chave (NUNCA retornar ao cliente) ────────────────────

    def get_decrypted_key(self, provider: str) -> str:
        """
        Retorna a API key descriptografada para uso INTERNO (chamadas à IA).
        NUNCA expor este valor em respostas HTTP.
        """
        result = (
            self._client.table(TABLE)
            .select("account_id, encrypted_api_key")
            .eq("account_id", self._account_id)
            .eq("provider", provider)
            .single()
            .execute()
        )
        if not result.data:
            raise NotFoundError(f"AI config para provider '{provider}' não encontrada.")
        self._assert_tenant(result.data)
        return decrypt(result.data["encrypted_api_key"])

    def mask_key(self, provider: str) -> str:
        """
        Retorna a chave mascarada (primeiros 8 chars + '***').
        Útil para confirmar ao usuário que uma chave está salva.
        """
        raw = self.get_decrypted_key(provider)
        visible = raw[:8] if len(raw) >= 8 else raw[:4]
        return f"{visible}{'*' * 20}"
