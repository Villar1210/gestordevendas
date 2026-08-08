"""
Router interno: /api/inboxes
Gerenciamento de contas WhatsApp Business (Inboxes).
Apenas Admin/Owner pode criar e deletar. Agents podem listar.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from app.application.whatsapp.inbox_use_cases import (
    CreateInboxUseCase,
    DeleteInboxUseCase,
    GetInboxUseCase,
    ListInboxesUseCase,
    UpdateInboxUseCase,
)
from app.core.dependencies import CurrentUser, get_current_user, require_admin, require_agent

router = APIRouter(prefix="/inboxes", tags=["Inboxes"])


class InboxCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone_number_id: str = Field(..., min_length=5)
    access_token: str = Field(..., min_length=10)
    webhook_verify_token: Optional[str] = None
    verify_credentials: bool = Field(
        True,
        description="Valida o phone_number_id e access_token com a Meta antes de salvar.",
    )


class InboxUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    access_token: Optional[str] = Field(None, min_length=10)
    webhook_verify_token: Optional[str] = None
    is_active: Optional[bool] = None


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Criar inbox (conta WhatsApp Business)",
)
async def create_inbox(
    body: InboxCreate,
    user: CurrentUser = Depends(require_admin),
):
    """
    Cria uma inbox conectada a um número WhatsApp Business via Meta Cloud API.
    O access_token é armazenado CRIPTOGRAFADO — nunca retornado ao frontend.
    Se `verify_credentials=true` (padrão), valida com a Meta antes de salvar.
    """
    uc = CreateInboxUseCase(user.account_id)
    return uc.execute(
        name=body.name,
        phone_number_id=body.phone_number_id,
        access_token=body.access_token,
        verify_credentials=body.verify_credentials,
        webhook_verify_token=body.webhook_verify_token,
    )


@router.get("", summary="Listar inboxes")
async def list_inboxes(user: CurrentUser = Depends(require_agent)):
    uc = ListInboxesUseCase(user.account_id)
    return uc.execute()


@router.get("/{inbox_id}", summary="Buscar inbox")
async def get_inbox(inbox_id: UUID, user: CurrentUser = Depends(require_agent)):
    uc = GetInboxUseCase(user.account_id)
    return uc.execute(inbox_id)


@router.patch("/{inbox_id}", summary="Atualizar inbox")
async def update_inbox(
    inbox_id: UUID,
    body: InboxUpdate,
    user: CurrentUser = Depends(require_admin),
):
    uc = UpdateInboxUseCase(user.account_id)
    data = body.model_dump(exclude_unset=True)
    return uc.execute(inbox_id, data)


@router.delete(
    "/{inbox_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deletar inbox",
)
async def delete_inbox(inbox_id: UUID, user: CurrentUser = Depends(require_admin)):
    uc = DeleteInboxUseCase(user.account_id)
    uc.execute(inbox_id)
