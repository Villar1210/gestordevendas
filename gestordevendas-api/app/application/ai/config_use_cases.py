"""
Use cases de AI Config — gerenciamento de chaves por account.

SEGURANÇA:
  - A chave raw NUNCA aparece em nenhum retorno HTTP.
  - Apenas TestAIConfigUseCase usa a chave internamente para validar.
  - Respostas mostram apenas a chave mascarada para confirmar que está salva.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.domain.exceptions import ValidationError
from app.infra.supabase.ai_config_repo import AIConfigRepository

logger = structlog.get_logger(__name__)

SUPPORTED_PROVIDERS = {"openai", "anthropic"}


class SaveAIConfigUseCase:
    """
    Salva (cria ou atualiza) a configuração de AI de um account.
    Criptografa a chave antes de persistir.
    """

    def __init__(self, account_id: UUID):
        self._repo = AIConfigRepository(account_id)

    def execute(
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
        if provider not in SUPPORTED_PROVIDERS:
            raise ValidationError(
                f"Provider '{provider}' não suportado. Use: {', '.join(sorted(SUPPORTED_PROVIDERS))}"
            )
        if not api_key or not api_key.strip():
            raise ValidationError("api_key não pode ser vazia.")
        if temperature < 0 or temperature > 2:
            raise ValidationError("temperature deve estar entre 0 e 2.")
        if max_tokens < 1 or max_tokens > 8192:
            raise ValidationError("max_tokens deve estar entre 1 e 8192.")

        result = self._repo.upsert(
            provider=provider,
            api_key=api_key.strip(),
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system_prompt=system_prompt,
            is_active=is_active,
        )

        # Adiciona chave mascarada para feedback ao usuário
        result["api_key_masked"] = self._repo.mask_key(provider)
        logger.info("ai_config_saved", provider=provider, account_id=str(self._repo._account_id))
        return result


class GetAIConfigUseCase:
    """Lista configs do account com chave mascarada. Nunca expõe a chave real."""

    def __init__(self, account_id: UUID):
        self._repo = AIConfigRepository(account_id)

    def execute(self, provider: Optional[str] = None) -> list[dict]:
        if provider:
            row = self._repo.get_by_provider(provider)
            rows = [row] if row else []
        else:
            rows = self._repo.list_all()

        # Adiciona chave mascarada em cada registro
        enriched = []
        for row in rows:
            try:
                row["api_key_masked"] = self._repo.mask_key(row["provider"])
            except Exception:
                row["api_key_masked"] = None
            enriched.append(row)
        return enriched


class TestAIConfigUseCase:
    """
    Valida a chave de AI fazendo uma chamada mínima ao provider.
    Não retorna nem loga a chave em nenhum momento.
    """

    def __init__(self, account_id: UUID):
        self._repo = AIConfigRepository(account_id)

    def execute(self, provider: str) -> dict:
        if provider not in SUPPORTED_PROVIDERS:
            raise ValidationError(f"Provider '{provider}' não suportado.")

        try:
            raw_key = self._repo.get_decrypted_key(provider)
        except Exception as e:
            return {"provider": provider, "valid": False, "error": str(e)}

        try:
            if provider == "openai":
                from app.infra.ai_providers.openai_client import OpenAIClient
                valid = OpenAIClient(raw_key).validate_key()
            elif provider == "anthropic":
                from app.infra.ai_providers.anthropic_client import AnthropicClient
                valid = AnthropicClient(raw_key).validate_key()
            else:
                valid = False

            return {"provider": provider, "valid": valid}
        except Exception as e:
            logger.warning("ai_key_test_failed", provider=provider, error=str(e))
            return {"provider": provider, "valid": False, "error": str(e)}


class DeleteAIConfigUseCase:
    def __init__(self, account_id: UUID):
        self._repo = AIConfigRepository(account_id)

    def execute(self, provider: str) -> dict:
        if provider not in SUPPORTED_PROVIDERS:
            raise ValidationError(f"Provider '{provider}' não suportado.")
        self._repo.delete(provider)
        return {"deleted": True, "provider": provider}
