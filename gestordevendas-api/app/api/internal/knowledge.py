"""
Router interno: /api/ai/knowledge
Base de conhecimento para o chatbot. Admin pode gerenciar; qualquer agente pode buscar.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.application.ai.knowledge_use_cases import (
    CreateKnowledgeEntryUseCase,
    DeleteKnowledgeEntryUseCase,
    GetKnowledgeEntryUseCase,
    ListKnowledgeEntriesUseCase,
    SearchKnowledgeUseCase,
    UpdateKnowledgeEntryUseCase,
)
from app.core.dependencies import CurrentUser, get_current_user, require_admin

router = APIRouter(prefix="/ai/knowledge", tags=["Knowledge Base"])


class KnowledgeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=10, max_length=10_000)
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[list[str]] = Field(None, max_length=20)


class KnowledgeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=10, max_length=10_000)
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[list[str]] = Field(None, max_length=20)
    is_active: Optional[bool] = None


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Criar entrada na base de conhecimento",
)
async def create_entry(
    body: KnowledgeCreate,
    user: CurrentUser = Depends(require_admin),
):
    """
    Cria uma entrada. O embedding é gerado assincronamente pelo worker Celery.
    Requer OpenAI configurado para busca semântica.
    """
    uc = CreateKnowledgeEntryUseCase(user.account_id)
    return uc.execute(
        title=body.title,
        content=body.content,
        category=body.category,
        tags=body.tags,
        created_by=user.user_id,
    )


@router.get("", summary="Listar entradas da knowledge base")
async def list_entries(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Busca por texto no conteúdo"),
    is_active: Optional[bool] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    uc = ListKnowledgeEntriesUseCase(user.account_id)
    return uc.execute(
        page=page,
        per_page=per_page,
        category=category,
        search=search,
        is_active=is_active,
    )


@router.get("/search", summary="Busca semântica na knowledge base")
async def search_knowledge(
    q: str = Query(..., min_length=3, description="Query de busca"),
    limit: int = Query(5, ge=1, le=20),
    user: CurrentUser = Depends(get_current_user),
):
    """
    Busca semântica usando embeddings (pgvector). Fallback para busca por texto.
    """
    uc = SearchKnowledgeUseCase(user.account_id)
    return uc.execute(q, limit=limit)


@router.get("/{entry_id}", summary="Buscar entrada por ID")
async def get_entry(
    entry_id: UUID,
    user: CurrentUser = Depends(get_current_user),
):
    uc = GetKnowledgeEntryUseCase(user.account_id)
    return uc.execute(entry_id)


@router.patch("/{entry_id}", summary="Atualizar entrada")
async def update_entry(
    entry_id: UUID,
    body: KnowledgeUpdate,
    user: CurrentUser = Depends(require_admin),
):
    uc = UpdateKnowledgeEntryUseCase(user.account_id)
    return uc.execute(entry_id, body.model_dump(exclude_unset=True))


@router.delete("/{entry_id}", summary="Remover entrada")
async def delete_entry(
    entry_id: UUID,
    user: CurrentUser = Depends(require_admin),
):
    uc = DeleteKnowledgeEntryUseCase(user.account_id)
    return uc.execute(entry_id)
