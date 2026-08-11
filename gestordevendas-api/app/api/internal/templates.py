"""
Router para Message Templates.
Endpoints: CRUD + aplicação de templates.
"""
from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.internal.schemas import (
    MessageTemplateCreate,
    MessageTemplateUpdate,
    MessageTemplateResponse,
)
from app.application.templates.use_cases import (
    CreateTemplateUseCase,
    ListTemplatesUseCase,
    GetTemplateUseCase,
    UpdateTemplateUseCase,
    DeleteTemplateUseCase,
    ApplyTemplateUseCase,
)
from app.core.security import get_current_user
from app.infra.supabase.client import SupabaseClient
from app.infra.supabase.template_repository import SupabaseTemplateRepository

router = APIRouter(prefix="/templates", tags=["Message Templates"])


def get_template_repo(supabase: SupabaseClient = Depends()) -> SupabaseTemplateRepository:
    """Dependency para injetar repository."""
    return SupabaseTemplateRepository(supabase)


@router.post(
    "",
    response_model=MessageTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar novo template de mensagem",
)
async def create_template(
    data: MessageTemplateCreate,
    current_user = Depends(get_current_user),
    repo = Depends(get_template_repo),
):
    """Criar novo template de mensagem para o account."""
    try:
        uc = CreateTemplateUseCase(repo)
        template = uc.execute(current_user.account_id, data, current_user.id)
        return MessageTemplateResponse(**template)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "",
    response_model=list[MessageTemplateResponse],
    summary="Listar templates de mensagem",
)
async def list_templates(
    category: str = None,
    include_inactive: bool = False,
    current_user = Depends(get_current_user),
    repo = Depends(get_template_repo),
):
    """Listar todos os templates do account."""
    try:
        uc = ListTemplatesUseCase(repo)
        templates = uc.execute(
            current_user.account_id,
            category=category,
            include_inactive=include_inactive,
        )
        return [MessageTemplateResponse(**t) for t in templates]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{template_id}",
    response_model=MessageTemplateResponse,
    summary="Buscar template específico",
)
async def get_template(
    template_id: UUID,
    current_user = Depends(get_current_user),
    repo = Depends(get_template_repo),
):
    """Buscar um template específico pelo ID."""
    try:
        uc = GetTemplateUseCase(repo)
        template = uc.execute(current_user.account_id, template_id)
        return MessageTemplateResponse(**template)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "/{template_id}",
    response_model=MessageTemplateResponse,
    summary="Atualizar template",
)
async def update_template(
    template_id: UUID,
    data: MessageTemplateUpdate,
    current_user = Depends(get_current_user),
    repo = Depends(get_template_repo),
):
    """Atualizar um template existente."""
    try:
        uc = UpdateTemplateUseCase(repo)
        template = uc.execute(current_user.account_id, template_id, data)
        return MessageTemplateResponse(**template)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deletar template",
)
async def delete_template(
    template_id: UUID,
    current_user = Depends(get_current_user),
    repo = Depends(get_template_repo),
):
    """Deletar um template."""
    try:
        uc = DeleteTemplateUseCase(repo)
        uc.execute(current_user.account_id, template_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ApplyTemplateRequest:
    """Request body para aplicar template com variáveis."""
    variables: dict[str, str] = {}


@router.post(
    "/{template_id}/apply",
    response_model=MessageTemplateResponse,
    summary="Aplicar template (substituir variáveis)",
)
async def apply_template(
    template_id: UUID,
    variables: dict[str, str] = None,
    current_user = Depends(get_current_user),
    repo = Depends(get_template_repo),
):
    """
    Aplicar template substituindo variáveis.
    Incrementa contador de uso.
    Exemplo: {{name}} → "João"
    """
    try:
        uc = ApplyTemplateUseCase(repo)
        template = uc.execute(
            current_user.account_id,
            template_id,
            variables=variables or {},
        )
        return MessageTemplateResponse(**template)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
