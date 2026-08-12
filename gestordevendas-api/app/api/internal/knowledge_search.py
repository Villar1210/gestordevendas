"""Endpoints para Knowledge Base Vector Search (Task 3)"""
from fastapi import APIRouter, Depends, HTTPException
from app.api.internal.knowledge_schemas import (
    KnowledgeBaseCreate,
    SearchKnowledgeRequest,
    SearchKnowledgeResponse,
    KnowledgeBaseResponse,
)
from app.core.auth import get_current_user
from app.application.knowledge.use_cases import (
    SearchKnowledgeUseCase,
    CreateKnowledgeUseCase,
    GetKnowledgeUseCase,
)
from app.infra.supabase.knowledge_repository import KnowledgeRepository
from app.core.supabase import get_supabase

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


@router.post("", status_code=201)
async def create_knowledge(
    knowledge_data: KnowledgeBaseCreate,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Criar novo documento de conhecimento"""
    try:
        repository = KnowledgeRepository(supabase)
        use_case = CreateKnowledgeUseCase(repository)

        result = await use_case.execute(
            account_id=user.get("account_id"),
            title=knowledge_data.title,
            content=knowledge_data.content,
            category=knowledge_data.category,
            created_by=user.get("id"),
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating knowledge: {str(e)}")


@router.get("/{knowledge_id}", status_code=200)
async def get_knowledge(
    knowledge_id: str,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Obter documento de conhecimento por ID"""
    try:
        repository = KnowledgeRepository(supabase)
        use_case = GetKnowledgeUseCase(repository)

        result = await use_case.execute(
            account_id=user.get("account_id"),
            knowledge_id=knowledge_id,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting knowledge: {str(e)}")


@router.post("/search", status_code=200)
async def search_knowledge(
    search_data: SearchKnowledgeRequest,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Buscar conhecimento por similaridade (requer embedding)"""
    try:
        repository = KnowledgeRepository(supabase)
        use_case = SearchKnowledgeUseCase(repository)

        # NOTE: In production, generate embedding from search_data.query
        # using OpenAI API or similar embedding service
        # For now, return placeholder response
        # TODO: Implement embedding service integration

        result = await use_case.execute(
            account_id=user.get("account_id"),
            embedding=[0.0] * 1536,  # Placeholder: all zeros
            limit=search_data.limit,
            threshold=search_data.threshold,
        )

        return SearchKnowledgeResponse(
            query=search_data.query,
            results=result.get("results", []),
            total=result.get("total", 0),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching knowledge: {str(e)}")
