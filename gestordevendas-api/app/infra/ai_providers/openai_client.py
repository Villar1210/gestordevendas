"""
Cliente OpenAI: chat completion + geração de embeddings.

Modelos padrão:
  - Chat:       gpt-4o-mini  (rápido, barato — ideal para atendimento)
  - Embeddings: text-embedding-3-small  (1536 dims, custo mínimo)
"""
from __future__ import annotations

import structlog
from openai import OpenAI, APIError, RateLimitError as OpenAIRateLimitError

from app.domain.exceptions import ExternalServiceError, RateLimitError

logger = structlog.get_logger(__name__)

DEFAULT_CHAT_MODEL = "gpt-4o-mini"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"


class OpenAIClient:
    def __init__(self, api_key: str):
        self._client = OpenAI(api_key=api_key)

    # ── Chat Completion ────────────────────────────────────────────────────────

    def chat(
        self,
        messages: list[dict],
        *,
        model: str = DEFAULT_CHAT_MODEL,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """
        Envia uma lista de mensagens e retorna o texto da resposta.
        messages: [{"role": "system"|"user"|"assistant", "content": "..."}]
        """
        try:
            response = self._client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except OpenAIRateLimitError as e:
            raise RateLimitError(f"OpenAI rate limit: {e}") from e
        except APIError as e:
            raise ExternalServiceError(f"OpenAI API error: {e}") from e

    def validate_key(self) -> bool:
        """Valida a chave fazendo uma chamada mínima (1 token)."""
        try:
            self._client.chat.completions.create(
                model=DEFAULT_CHAT_MODEL,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            return True
        except Exception:
            return False

    # ── Embeddings ─────────────────────────────────────────────────────────────

    def embed(
        self,
        text: str,
        *,
        model: str = DEFAULT_EMBEDDING_MODEL,
    ) -> list[float]:
        """
        Gera embedding para um texto.
        Retorna vetor de floats (1536 dims para text-embedding-3-small).
        """
        try:
            response = self._client.embeddings.create(
                model=model,
                input=text,
            )
            return response.data[0].embedding
        except OpenAIRateLimitError as e:
            raise RateLimitError(f"OpenAI embed rate limit: {e}") from e
        except APIError as e:
            raise ExternalServiceError(f"OpenAI embed error: {e}") from e

    def embed_batch(
        self,
        texts: list[str],
        *,
        model: str = DEFAULT_EMBEDDING_MODEL,
    ) -> list[list[float]]:
        """Gera embeddings para múltiplos textos em uma única chamada."""
        try:
            response = self._client.embeddings.create(
                model=model,
                input=texts,
            )
            return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
        except OpenAIRateLimitError as e:
            raise RateLimitError(f"OpenAI embed batch rate limit: {e}") from e
        except APIError as e:
            raise ExternalServiceError(f"OpenAI embed batch error: {e}") from e
