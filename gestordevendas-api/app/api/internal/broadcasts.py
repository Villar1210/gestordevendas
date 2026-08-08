"""
Router interno: /api/broadcasts
Envio em massa via WhatsApp Template Messages.
Apenas Admin/Owner pode criar e lançar. Agents podem visualizar.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.application.broadcasts.use_cases import (
    AddRecipientsToBroadcastUseCase,
    CancelBroadcastUseCase,
    CreateBroadcastUseCase,
    GetBroadcastUseCase,
    LaunchBroadcastUseCase,
    ListBroadcastsUseCase,
)
from app.core.dependencies import CurrentUser, get_current_user, require_admin, require_agent

router = APIRouter(prefix="/broadcasts", tags=["Broadcasts"])


class BroadcastCreate(BaseModel):
    inbox_id: UUID
    name: str = Field(..., min_length=1, max_length=200)
    template_name: str = Field(..., min_length=1, max_length=200)
    template_params: Optional[list[str]] = Field(
        None,
        description="Parâmetros do template ({{1}}, {{2}}, ...). "
                    "Use {{contact.name}} para interpolação automática (Fase 5).",
    )
    language_code: str = Field("pt_BR", max_length=10)
    scheduled_at: Optional[str] = Field(
        None, description="ISO8601. Se informado, status inicial = 'scheduled'."
    )


class AddRecipientsBody(BaseModel):
    contact_ids: Optional[list[str]] = Field(
        None, description="IDs de contatos já cadastrados."
    )
    phones: Optional[list[str]] = Field(
        None,
        description="Números de telefone avulsos (E.164). "
                    "Contatos serão criados automaticamente se não existirem.",
    )


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Criar broadcast",
)
async def create_broadcast(
    body: BroadcastCreate,
    user: CurrentUser = Depends(require_admin),
):
    uc = CreateBroadcastUseCase(user.account_id)
    return uc.execute(
        inbox_id=body.inbox_id,
        name=body.name,
        template_name=body.template_name,
        template_params=body.template_params,
        language_code=body.language_code,
        scheduled_at=body.scheduled_at,
        created_by=user.user_id,
    )


@router.get("", summary="Listar broadcasts")
async def list_broadcasts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None, pattern="^(draft|scheduled|running|completed|cancelled|failed)$"),
    user: CurrentUser = Depends(get_current_user),
):
    uc = ListBroadcastsUseCase(user.account_id)
    return uc.execute(page=page, per_page=per_page, status=status)


@router.get("/{broadcast_id}", summary="Buscar broadcast")
async def get_broadcast(
    broadcast_id: UUID,
    user: CurrentUser = Depends(get_current_user),
):
    uc = GetBroadcastUseCase(user.account_id)
    return uc.execute(broadcast_id)


# ── Destinatários ─────────────────────────────────────────────────────────────

@router.post(
    "/{broadcast_id}/recipients",
    summary="Adicionar destinatários",
)
async def add_recipients(
    broadcast_id: UUID,
    body: AddRecipientsBody,
    user: CurrentUser = Depends(require_admin),
):
    uc = AddRecipientsToBroadcastUseCase(user.account_id)
    return uc.execute(
        broadcast_id,
        contact_ids=body.contact_ids,
        phones=body.phones,
    )


# ── Ações de ciclo de vida ────────────────────────────────────────────────────

@router.post(
    "/{broadcast_id}/launch",
    summary="Lançar broadcast (iniciar envios)",
)
async def launch_broadcast(
    broadcast_id: UUID,
    user: CurrentUser = Depends(require_admin),
):
    """
    Valida o broadcast, muda status para 'running' e enfileira o worker Celery.
    O envio ocorre em background com rate limiting de 1 msg/s.
    """
    uc = LaunchBroadcastUseCase(user.account_id)
    return uc.execute(broadcast_id)


@router.post(
    "/{broadcast_id}/cancel",
    summary="Cancelar broadcast",
)
async def cancel_broadcast(
    broadcast_id: UUID,
    user: CurrentUser = Depends(require_admin),
):
    """
    Marca o broadcast como 'cancelled'. O worker em execução interrompe
    no próximo destinatário ao detectar a mudança de status.
    """
    uc = CancelBroadcastUseCase(user.account_id)
    return uc.execute(broadcast_id)
