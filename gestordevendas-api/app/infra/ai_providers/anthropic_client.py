"""
Cliente Anthropic: chat completion via Messages API.

Modelo padrão: claude-haiku-4-5-20251001 (rápido, barato).
Anthropic não oferece embeddings — use OpenAI para isso.
"""
from __future__ import annotations

import structlog
import anthropic
from anthropic import APIError, RateLimitError as AnthropicRateLimitError

from app.domain.exceptions import ExternalServiceError, RateLimitError

logger = structlog.get_logger(__name__)

DEFAULT_MODEL = "claude-haiku-4-5-20251001"


class AnthropicClient:
    def __init__(self, api_key: str):
        self._client = anthropic.Anthropic(api_key=api_key)

    def chat(
        self,
        messages: list[dict],
        *,
        model: str = DEFAULT_MODEL,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        system_prompt: str | None = None,
    ) -> str:
        """
        Envia mensagens e retorna o texto da resposta.
        messages: [{"role": "user"|"assistant", "content": "..."}]
        Nota: Anthropic separa o system_prompt do messages array.
        """
        # Anthropic não aceita role="system" dentro de messages
        anthropic_messages = [
            m for m in messages if m.get("role") != "system"
        ]

        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": anthropic_messages,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        try:
            response = self._client.messages.create(**kwargs)
            if response.content and len(response.content) > 0:
                return response.content[0].text
            return ""
        except AnthropicRateLimitError as e:
            raise RateLimitError(f"Anthropic rate limit: {e}") from e
        except APIError as e:
            raise ExternalServiceError(f"Anthropic API error: {e}") from e

    def validate_key(self) -> bool:
        """Valida a chave fazendo uma chamada mínima."""
        try:
            self._client.messages.create(
                model=DEFAULT_MODEL,
                max_tokens=1,
                messages=[{"role": "user", "content": "ping"}],
            )
            return True
        except Exception:
            return False
