"""
Router interno: /api/conversations
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel

from app.api.internal.schemas import ConversationAssign, ConversationOut
from app.application.conversations.use_cases import (
    AssignConversationUseCase,
    CloseConversationUseCase,
    CreateConversationUseCase,
    GetConversationUseCase,
    ListConversationsUseCase,
    ReopenConversationUseCase,
    ToggleAIUseCase,
)
from app.core.dependencies import CurrentUser, get_current_user, require_agent

router = APIRouter(prefix="/conversations", tags=["Conversations"])


# ── Criação ───────────────────────────────────────────────────────────────────

class ConversationCreateBody(BaseModel):
    contact_id: UUID
    inbox_id: UUID
    assignee_id: Optional[UUID] = None


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Criar conversa",
)
async def create_conversation(
    body: ConversationCreateBody,
    user: CurrentUser = Depends(require_agent),
):
    uc = CreateConversationUseCase(user.account_id)
    return uc.execute(
        contact_id=body.contact_id,
        inbox_id=body.inbox_id,
        assignee_id=body.assignee_id,
    )


# ── Listagem ──────────────────────────────────────────────────────────────────

@router.get("", summary="Listar conversas")
async def list_conversations(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None, pattern="^(open|resolved|pending|snoozed)$"),
    assignee_id: Optional[UUID] = Query(None),
    contact_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    uc = ListConversationsUseCase(user.account_id)
    return uc.execute(
        page=page,
        per_page=per_page,
        status=status,
        assignee_id=assignee_id,
        contact_id=contact_id,
        search=search,
    )


# ── Detalhe ───────────────────────────────────────────────────────────────────

@router.get("/{conversation_id}", summary="Buscar conversa")
async def get_conversation(
    conversation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
):
    uc = GetConversationUseCase(user.account_id)
    return uc.execute(conversation_id)


# ── Ações ─────────────────────────────────────────────────────────────────────

@router.patch("/{conversation_id}/assign", summary="Atribuir conversa a um agente")
async def assign_conversation(
    conversation_id: UUID,
    body: ConversationAssign,
    user: CurrentUser = Depends(require_agent),
):
    uc = AssignConversationUseCase(user.account_id)
    return uc.execute(conversation_id, body.assignee_id)


@router.post("/{conversation_id}/close", summary="Fechar (resolver) conversa")
async def close_conversation(
    conversation_id: UUID,
    user: CurrentUser = Depends(require_agent),
):
    uc = CloseConversationUseCase(user.account_id)
    return uc.execute(conversation_id)


@router.post("/{conversation_id}/reopen", summary="Reabrir conversa")
async def reopen_conversation(
    conversation_id: UUID,
    user: CurrentUser = Depends(require_agent),
):
    uc = ReopenConversationUseCase(user.account_id)
    return uc.execute(conversation_id)


class ToggleAIBody(BaseModel):
    enabled: bool


@router.patch("/{conversation_id}/ai", summary="Habilitar / desabilitar IA na conversa")
async def toggle_ai(
    conversation_id: UUID,
    body: ToggleAIBody,
    user: CurrentUser = Depends(require_agent),
):
    uc = ToggleAIUseCase(user.account_id)
    return uc.execute(conversation_id, body.enabled)
