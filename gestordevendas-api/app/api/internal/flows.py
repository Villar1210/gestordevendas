"""
Router interno: /api/flows
Chatbot flows com trigger por keyword. Apenas Admin/Owner gerencia; qualquer agente visualiza.
"""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.application.flows.use_cases import (
    CreateFlowUseCase,
    DeleteFlowUseCase,
    GetFlowRunsUseCase,
    GetFlowUseCase,
    ListFlowsUseCase,
    UpdateFlowUseCase,
)
from app.core.dependencies import CurrentUser, get_current_user, require_admin

router = APIRouter(prefix="/flows", tags=["Chatbot Flows"])


class FlowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    trigger_keywords: list[str] = Field(
        default_factory=list,
        description=(
            "Palavras-chave que disparam o flow (case-insensitive, busca substring). "
            "Ex: ['oi', 'olá', 'começar']"
        ),
    )
    nodes: list[dict[str, Any]] = Field(
        ...,
        description=(
            "Sequência de nós do flow. Tipos suportados: "
            "'message' (envia texto), "
            "'condition' (avalia resposta do usuário), "
            "'action' (executa ação: assign_conversation, close_conversation, add_tag, remove_tag)."
        ),
    )
    is_active: bool = True


class FlowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    trigger_keywords: Optional[list[str]] = None
    nodes: Optional[list[dict[str, Any]]] = None
    is_active: Optional[bool] = None


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Criar chatbot flow",
)
async def create_flow(
    body: FlowCreate,
    user: CurrentUser = Depends(require_admin),
):
    """
    Cria um flow com nós e keywords de disparo.
    O flow é ativado automaticamente quando uma mensagem inbound contém uma das keywords.
    """
    uc = CreateFlowUseCase(user.account_id)
    return uc.execute(
        name=body.name,
        nodes=body.nodes,
        trigger_keywords=body.trigger_keywords,
        description=body.description,
        is_active=body.is_active,
        created_by=user.user_id,
    )


@router.get("", summary="Listar flows")
async def list_flows(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    uc = ListFlowsUseCase(user.account_id)
    return uc.execute(page=page, per_page=per_page, is_active=is_active)


@router.get("/{flow_id}", summary="Buscar flow por ID")
async def get_flow(
    flow_id: UUID,
    user: CurrentUser = Depends(get_current_user),
):
    uc = GetFlowUseCase(user.account_id)
    return uc.execute(flow_id)


@router.patch("/{flow_id}", summary="Atualizar flow")
async def update_flow(
    flow_id: UUID,
    body: FlowUpdate,
    user: CurrentUser = Depends(require_admin),
):
    uc = UpdateFlowUseCase(user.account_id)
    return uc.execute(flow_id, body.model_dump(exclude_unset=True))


@router.delete("/{flow_id}", summary="Remover flow")
async def delete_flow(
    flow_id: UUID,
    user: CurrentUser = Depends(require_admin),
):
    uc = DeleteFlowUseCase(user.account_id)
    return uc.execute(flow_id)


# ── Flow Runs ─────────────────────────────────────────────────────────────────

@router.get("/{flow_id}/runs", summary="Listar execuções de um flow")
async def list_flow_runs(
    flow_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    """
    Lista as execuções (flow_runs) de um flow específico.
    Útil para monitorar quantas conversas passaram pelo flow e seus status.
    """
    uc = GetFlowRunsUseCase(user.account_id)
    return uc.execute(flow_id, page=page, per_page=per_page)
