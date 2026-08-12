"""Use cases para Knowledge Base Vector Search (Task 3)"""
from app.infra.supabase.knowledge_repository import KnowledgeRepository


class SearchKnowledgeUseCase:
    """Buscar conhecimento por similaridade de embedding"""

    def __init__(self, repository: KnowledgeRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        embedding: list[float],
        limit: int = 5,
        threshold: float = 0.5,
    ):
        """Buscar conhecimento por embedding"""
        if not embedding:
            raise ValueError("Embedding cannot be empty")

        if len(embedding) != 1536:
            raise ValueError("Embedding must have 1536 dimensions (OpenAI format)")

        results = await self.repository.search_by_embedding(
            account_id=account_id,
            embedding=embedding,
            limit=limit,
            threshold=threshold,
        )

        return {
            "results": results,
            "total": len(results),
        }


class CreateKnowledgeUseCase:
    """Criar novo documento de conhecimento"""

    def __init__(self, repository: KnowledgeRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        title: str,
        content: str,
        category: str = "general",
        created_by: str = None,
    ):
        """Criar documento de conhecimento"""
        if not title or len(title) < 1:
            raise ValueError("Title is required")

        if not content or len(content) < 10:
            raise ValueError("Content must be at least 10 characters")

        knowledge = await self.repository.create_knowledge(
            account_id=account_id,
            title=title,
            content=content,
            category=category,
            created_by=created_by,
        )

        if not knowledge:
            raise ValueError("Failed to create knowledge document")

        return knowledge


class GetKnowledgeUseCase:
    """Obter um documento de conhecimento"""

    def __init__(self, repository: KnowledgeRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        knowledge_id: str,
    ):
        """Obter documento de conhecimento"""
        knowledge = await self.repository.get_knowledge_by_id(
            account_id=account_id,
            knowledge_id=knowledge_id,
        )

        if not knowledge:
            raise ValueError(f"Knowledge document {knowledge_id} not found")

        return knowledge
