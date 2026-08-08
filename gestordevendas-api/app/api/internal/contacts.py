"""
Router interno: /api/contacts
Autenticado por JWT Supabase. Isolamento por account_id do token.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.internal.schemas import (
    ContactCreate, ContactListParams, ContactOut, ContactUpdate,
)
from app.application.contacts.use_cases import (
    CreateContactUseCase,
    DeleteContactUseCase,
    GetContactUseCase,
    ListContactsUseCase,
    UpdateContactUseCase,
)
from app.core.dependencies import CurrentUser, get_current_user, require_agent

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.post(
    "",
    response_model=ContactOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar contato",
)
async def create_contact(
    body: ContactCreate,
    user: CurrentUser = Depends(require_agent),
):
    """Cria um novo contato para o account do usuário logado."""
    uc = CreateContactUseCase(user.account_id)
    result = uc.execute(
        name=body.name,
        phone=body.phone,
        email=body.email,
        avatar_url=body.avatar_url,
        custom_attributes=body.custom_attributes,
        tags=body.tags,
    )
    return result


@router.get(
    "",
    summary="Listar contatos",
)
async def list_contacts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: str | None = Query(None, description="Busca por nome ou telefone"),
    tag: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),   # viewer pode listar
):
    uc = ListContactsUseCase(user.account_id)
    return uc.execute(page=page, per_page=per_page, search=search, tag=tag)


@router.get(
    "/{contact_id}",
    response_model=ContactOut,
    summary="Buscar contato por ID",
)
async def get_contact(
    contact_id: UUID,
    user: CurrentUser = Depends(get_current_user),
):
    uc = GetContactUseCase(user.account_id)
    return uc.execute(contact_id)


@router.patch(
    "/{contact_id}",
    response_model=ContactOut,
    summary="Atualizar contato",
)
async def update_contact(
    contact_id: UUID,
    body: ContactUpdate,
    user: CurrentUser = Depends(require_agent),
):
    uc = UpdateContactUseCase(user.account_id)
    # to_repo_dict() mapeia custom_fields -> custom_attributes para o DB
    data = body.to_repo_dict()
    return uc.execute(contact_id, data)


@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deletar contato",
)
async def delete_contact(
    contact_id: UUID,
    user: CurrentUser = Depends(require_agent),
):
    uc = DeleteContactUseCase(user.account_id)
    uc.execute(contact_id)
