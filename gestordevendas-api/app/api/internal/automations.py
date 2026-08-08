"""
Router interno: /api/automations
"""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.application.automations.use_cases import (
    CreateAutomationUseCase,
    DeleteAutomationUseCase,
    GetAutomationUseCase,
    GetExecutionLogsUseCase,
    ListAutomationsUseCase,
    UpdateAutomationUseCase,
)
from app.core.dependencies import CurrentUser, get_current_user, require_admin, require_agent

router = APIRouter(prefix="/automations", tags=["Automations"])

# Eventos de gatilho disponíveis
TRIGGER_EVENTS = [
    "conversation_created",
    "message_received",
    "contact_created",
    "conversation_assigned",
    "conversation_resolved",
]


class AutomationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    trigger_event: str = Field(..., description=f"Um de: {', '.join(TRIGGER_EVENTS)}")
    conditions: Optional[dict[str, Any]] = Field(
        None,
        description='{"operator":"and","rules":[{"field":"contact.phone","op":"contains","value":"+55"}]}'
    )
    actions: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        description='[{"type":"send_message","template_name":"..."},{"type":"assign_conversation","assignee_id":"..."}]',
    )
    is_active: bool = True


class AutomationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    conditions: Optional[dict[str, Any]] = None
    actions: Optional[list[dict[str, Any]]] = None
    is_active: Optional[bool] = None


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Criar automação",
)
async def create_automation(
    body: AutomationCreate,
    user: CurrentUser = Depends(require_admin),
):
    uc = CreateAutomationUseCase(user.account_id)
    return uc.execute(
        name=body.name,
        trigger_event=body.trigger_event,
        actions=body.actions,
        conditions=body.conditions,
        description=body.description,
        is_active=body.is_active,
    )


@router.get("", summary="Listar automações")
async def list_automations(
    is_active: Optional[bool] = Query(None),
    trigger_event: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    uc = ListAutomationsUseCase(user.account_id)
    return uc.execute(is_active=is_active, trigger_event=trigger_event)


@router.get("/{automation_id}", summary="Buscar automação")
async def get_automation(
    automation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
):
    uc = GetAutomationUseCase(user.account_id)
    return uc.execute(automation_id)


@router.patch("/{automation_id}", summary="Atualizar automação")
async def update_automation(
    automation_id: UUID,
    body: AutomationUpdate,
    user: CurrentUser = Depends(require_admin),
):
    uc = UpdateAutomationUseCase(user.account_id)
    return uc.execute(automation_id, body.model_dump(exclude_unset=True))


@router.delete(
    "/{automation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deletar automação",
)
async def delete_automation(
    automation_id: UUID,
    user: CurrentUser = Depends(require_admin),
):
    uc = DeleteAutomationUseCase(user.account_id)
    uc.execute(automation_id)


@router.get(
    "/{automation_id}/executions",
    summary="Histórico de execuções",
)
async def list_executions(
    automation_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(require_agent),
):
    uc = GetExecutionLogsUseCase(user.account_id)
    return uc.execute(automation_id, limit=limit)
