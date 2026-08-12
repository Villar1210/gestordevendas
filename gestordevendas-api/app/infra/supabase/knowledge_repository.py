"""Repository para Knowledge Base com Vector Search"""
from typing import Optional
from app.domain.models import KnowledgeBase


class KnowledgeRepository:
    """Gerenciar documentos de conhecimento e embeddings"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def create_knowledge(
        self,
        account_id: str,
        title: str,
        content: str,
        category: str = "general",
        created_by: Optional[str] = None,
    ) -> dict:
        """Criar novo documento de conhecimento"""
        result = await self.supabase.table("knowledge_base").insert({
            "account_id": account_id,
            "title": title,
            "content": content,
            "category": category,
            "created_by": created_by,
        }).execute()

        return result.data[0] if result.data else None

    async def create_embedding(
        self,
        knowledge_id: str,
        account_id: str,
        content_chunk: str,
        embedding: list[float],
        chunk_index: int = 0,
    ) -> dict:
        """Criar embedding para um chunk de conhecimento"""
        result = await self.supabase.table("knowledge_embeddings").insert({
            "knowledge_id": knowledge_id,
            "account_id": account_id,
            "content_chunk": content_chunk,
            "embedding": embedding,
            "chunk_index": chunk_index,
        }).execute()

        return result.data[0] if result.data else None

    async def search_by_embedding(
        self,
        account_id: str,
        embedding: list[float],
        limit: int = 5,
        threshold: float = 0.5,
    ) -> list[dict]:
        """Buscar conhecimento por similaridade de embedding"""
        result = await self.supabase.rpc(
            "search_knowledge_embeddings",
            {
                "p_account_id": account_id,
                "p_embedding": embedding,
                "p_limit": limit,
                "p_threshold": threshold,
            },
        ).execute()

        return result.data if result.data else []

    async def get_knowledge_by_id(
        self,
        account_id: str,
        knowledge_id: str,
    ) -> Optional[dict]:
        """Obter documento de conhecimento por ID"""
        result = await self.supabase.table("knowledge_base").select("*").eq(
            "id", knowledge_id
        ).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def list_knowledge(
        self,
        account_id: str,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict]:
        """Listar documentos de conhecimento"""
        query = self.supabase.table("knowledge_base").select("*").eq(
            "account_id", account_id
        )

        if category:
            query = query.eq("category", category)

        result = await query.limit(limit).execute()
        return result.data if result.data else []
