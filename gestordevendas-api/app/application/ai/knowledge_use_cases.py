"""
Use cases de Knowledge Base.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.infra.supabase.knowledge_repo import KnowledgeRepository

logger = structlog.get_logger(__name__)


class CreateKnowledgeEntryUseCase:
    """
    Cria uma entrada de conhecimento e enfileira o worker de embeddings.
    O embedding é gerado assincronamente pelo worker Celery.
    """

    def __init__(self, account_id: UUID):
        self._repo = KnowledgeRepository(account_id)
        self._account_id = account_id

    def execute(
        self,
        *,
        title: str,
        content: str,
        category: Optional[str] = None,
        tags: Optional[list[str]] = None,
        created_by: Optional[str] = None,
    ) -> dict:
        entry = self._repo.create(
            title=title,
            content=content,
            category=category,
            tags=tags,
            created_by=created_by,
        )

        # Enfileira geração de embedding em background
        try:
            from app.workers.embeddings import generate_embedding
            generate_embedding.delay(
                entry_id=str(entry["id"]),
                account_id=str(self._account_id),
                text=f"{title}\n\n{content}",
            )
        except Exception as e:
            logger.warning("embed_queue_failed", entry_id=str(entry["id"]), error=str(e))

        return entry


class GetKnowledgeEntryUseCase:
    def __init__(self, account_id: UUID):
        self._repo = KnowledgeRepository(account_id)

    def execute(self, entry_id: UUID) -> dict:
        return self._repo.get_by_id(entry_id)


class ListKnowledgeEntriesUseCase:
    def __init__(self, account_id: UUID):
        self._repo = KnowledgeRepository(account_id)

    def execute(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        category: Optional[str] = None,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> dict:
        items, total = self._repo.list(
            page=page,
            per_page=per_page,
            category=category,
            search=search,
            is_active=is_active,
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (page * per_page) < total,
        }


class UpdateKnowledgeEntryUseCase:
    def __init__(self, account_id: UUID):
        self._repo = KnowledgeRepository(account_id)
        self._account_id = account_id

    def execute(self, entry_id: UUID, updates: dict) -> dict:
        entry = self._repo.update(entry_id, updates)

        # Re-gera embedding se o conteúdo mudou
        if "content" in updates or "title" in updates:
            try:
                from app.workers.embeddings import generate_embedding
                generate_embedding.delay(
                    entry_id=str(entry_id),
                    account_id=str(self._account_id),
                    text=f"{entry['title']}\n\n{entry['content']}",
                )
            except Exception as e:
                logger.warning("embed_requeue_failed", entry_id=str(entry_id), error=str(e))

        return entry


class DeleteKnowledgeEntryUseCase:
    def __init__(self, account_id: UUID):
        self._repo = KnowledgeRepository(account_id)

    def execute(self, entry_id: UUID) -> dict:
        self._repo.delete(entry_id)
        return {"deleted": True, "id": str(entry_id)}


class SearchKnowledgeUseCase:
    """
    Busca semântica na knowledge base.
    Usa embeddings (pgvector) se disponível, texto como fallback.
    """

    def __init__(self, account_id: UUID):
        self._repo = KnowledgeRepository(account_id)
        self._account_id = account_id

    def execute(self, query: str, *, limit: int = 5) -> list[dict]:
        if not query.strip():
            return []

        # Tenta busca vetorial se AI config existir
        try:
            from app.infra.supabase.ai_config_repo import AIConfigRepository
            ai_repo = AIConfigRepository(self._account_id)
            config = ai_repo.get_active()
            if config and config.get("provider") == "openai":
                raw_key = ai_repo.get_decrypted_key("openai")
                from app.infra.ai_providers.openai_client import OpenAIClient
                embedding = OpenAIClient(raw_key).embed(query)
                results = self._repo.search_by_embedding(embedding, limit=limit)
                if results:
                    return results
        except Exception as e:
            logger.warning("semantic_search_failed", error=str(e))

        # Fallback: busca por texto
        return self._repo.search_by_text(query, limit=limit)
