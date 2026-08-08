"""
Repositório de Knowledge Base — entradas de conhecimento com embeddings.

Schema esperado:
  ai_knowledge_entries: id, account_id, title, content,
                        embedding (vector(1536) via pgvector),
                        category, tags (JSONB), is_active,
                        created_by, created_at, updated_at

Busca semântica via pgvector: <=> (cosine distance).
Se pgvector não estiver habilitado, a busca fallback usa ILIKE no content.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.core.supabase import get_supabase_admin
from app.domain.exceptions import NotFoundError, TenantIsolationError

logger = structlog.get_logger(__name__)

TABLE = "ai_knowledge_entries"


class KnowledgeRepository:
    def __init__(self, account_id: UUID):
        self._account_id = str(account_id)
        self._client = get_supabase_admin()

    def _assert_tenant(self, row: dict) -> None:
        if row.get("account_id") != self._account_id:
            logger.critical(
                "tenant_isolation_violation",
                table=TABLE,
                expected=self._account_id,
                found=row.get("account_id"),
            )
            raise TenantIsolationError("Violação de isolamento em ai_knowledge_entries.")

    def _base(self):
        return (
            self._client.table(TABLE)
            .select("id, account_id, title, content, category, tags, is_active, created_at, updated_at")
            .eq("account_id", self._account_id)
        )

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        title: str,
        content: str,
        category: Optional[str] = None,
        tags: Optional[list[str]] = None,
        created_by: Optional[str] = None,
        embedding: Optional[list[float]] = None,
    ) -> dict:
        payload: dict = {
            "account_id": self._account_id,
            "title": title,
            "content": content,
            "is_active": True,
            "tags": tags or [],
        }
        if category:
            payload["category"] = category
        if created_by:
            payload["created_by"] = created_by
        if embedding:
            payload["embedding"] = embedding

        result = self._client.table(TABLE).insert(payload).execute()
        if not result.data:
            raise RuntimeError("Falha ao criar entrada de conhecimento.")
        self._assert_tenant(result.data[0])
        return result.data[0]

    def get_by_id(self, entry_id: UUID) -> dict:
        result = self._base().eq("id", str(entry_id)).single().execute()
        if not result.data:
            raise NotFoundError(f"Entrada {entry_id} não encontrada.")
        self._assert_tenant(result.data)
        return result.data

    def list(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        category: Optional[str] = None,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * per_page

        cq = self._client.table(TABLE).select("id", count="exact").eq(
            "account_id", self._account_id
        )
        if category:
            cq = cq.eq("category", category)
        if is_active is not None:
            cq = cq.eq("is_active", is_active)
        if search:
            cq = cq.ilike("content", f"%{search}%")
        total = (cq.execute().count) or 0

        dq = self._base().order("created_at", desc=True).range(offset, offset + per_page - 1)
        if category:
            dq = dq.eq("category", category)
        if is_active is not None:
            dq = dq.eq("is_active", is_active)
        if search:
            dq = dq.ilike("content", f"%{search}%")

        return dq.execute().data or [], total

    def update(self, entry_id: UUID, updates: dict) -> dict:
        self.get_by_id(entry_id)  # valida tenant + existência
        allowed = {"title", "content", "category", "tags", "is_active", "embedding"}
        payload = {k: v for k, v in updates.items() if k in allowed}
        if not payload:
            return self.get_by_id(entry_id)

        self._client.table(TABLE).update(payload).eq(
            "id", str(entry_id)
        ).eq("account_id", self._account_id).execute()
        return self.get_by_id(entry_id)

    def delete(self, entry_id: UUID) -> None:
        self.get_by_id(entry_id)
        self._client.table(TABLE).delete().eq(
            "id", str(entry_id)
        ).eq("account_id", self._account_id).execute()

    def set_embedding(self, entry_id: UUID, embedding: list[float]) -> None:
        """Atualiza o vetor de embedding de uma entrada (chamado pelo worker)."""
        self._client.table(TABLE).update({"embedding": embedding}).eq(
            "id", str(entry_id)
        ).eq("account_id", self._account_id).execute()

    # ── Busca semântica ────────────────────────────────────────────────────────

    def search_by_embedding(
        self,
        query_embedding: list[float],
        *,
        limit: int = 5,
        similarity_threshold: float = 0.7,
    ) -> list[dict]:
        """
        Busca por similaridade vetorial usando pgvector (<=> cosine distance).
        Requer extensão pgvector habilitada no Supabase e coluna 'embedding vector(1536)'.

        Fallback: se a chamada RPC falhar, retorna lista vazia (não quebra o chatbot).
        """
        try:
            result = self._client.rpc(
                "match_knowledge_entries",
                {
                    "query_embedding": query_embedding,
                    "match_account_id": self._account_id,
                    "match_threshold": 1.0 - similarity_threshold,  # distance = 1 - similarity
                    "match_count": limit,
                },
            ).execute()
            return result.data or []
        except Exception as e:
            logger.warning("vector_search_failed", error=str(e))
            return []

    def search_by_text(self, query: str, *, limit: int = 5) -> list[dict]:
        """Fallback de busca por texto quando embeddings não estão disponíveis."""
        result = (
            self._base()
            .eq("is_active", True)
            .ilike("content", f"%{query}%")
            .limit(limit)
            .execute()
        )
        return result.data or []
