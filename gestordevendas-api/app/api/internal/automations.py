"""Endpoints para Automations Module (Task 2, Fase 3)"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.automations_schemas import (
    AutomationCreate,
    AutomationUpdate,
    AutomationResponse,
    AVAILABLE_ACTIONS,
    TRIGGER_TYPES,
)
from app.application.automations.use_cases import (
    CreateAutomationUseCase,
    ListAutomationsUseCase,
    GetAutomationUseCase,
    UpdateAutomationUseCase,
    DeleteAutomationUseCase,
    GetAutomationLogsUseCase,
    ExecuteAutomationUseCase,
)
from app.infra.supabase.automations_repository import AutomationsRepository

router = APIRouter(prefix="/automations", tags=["Automations"])


@router.get("/triggers", summary="Listar tipos de triggers disponíveis")
async def list_triggers():
    """Listar todos os tipos de triggers suportados"""
    return {
        "triggers": TRIGGER_TYPES,
        "count": len(TRIGGER_TYPES),
    }


@router.get("/actions", summary="Listar tipos de ações disponíveis")
async def list_actions():
    """Listar todas as ações suportadas com seus parâmetros"""
    return {
        "actions": AVAILABLE_ACTIONS,
        "count": len(AVAILABLE_ACTIONS),
    }


@router.post("/", response_model=AutomationResponse, status_code=status.HTTP_201_CREATED, summary="Criar automação")
async def create_automation(
    automation_data: AutomationCreate,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Criar nova automação"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    automations_repository = AutomationsRepository(supabase)
    use_case = CreateAutomationUseCase(automations_repository)

    try:
        return await use_case.execute(account_id, automation_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/", summary="Listar automações")
async def list_automations(
    active_only: bool = False,
    limit: int = 20,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Listar automações do tenant"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    automations_repository = AutomationsRepository(supabase)
    use_case = ListAutomationsUseCase(automations_repository)

    return await use_case.execute(
        account_id,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )


@router.get("/{automation_id}", response_model=AutomationResponse, summary="Obter automação")
async def get_automation(
    automation_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter automação específica"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    automations_repository = AutomationsRepository(supabase)
    use_case = GetAutomationUseCase(automations_repository)

    try:
        return await use_case.execute(automation_id, account_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.patch("/{automation_id}", response_model=AutomationResponse, summary="Atualizar automação")
async def update_automation(
    automation_id: str,
    automation_data: AutomationUpdate,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Atualizar automação"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    automations_repository = AutomationsRepository(supabase)
    use_case = UpdateAutomationUseCase(automations_repository)

    try:
        return await use_case.execute(automation_id, account_id, automation_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/{automation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deletar automação")
async def delete_automation(
    automation_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Deletar automação"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    automations_repository = AutomationsRepository(supabase)
    use_case = DeleteAutomationUseCase(automations_repository)

    try:
        await use_case.execute(automation_id, account_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/{automation_id}/logs", summary="Obter logs de automação")
async def get_automation_logs(
    automation_id: str,
    limit: int = 50,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter logs de execução da automação"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    automations_repository = AutomationsRepository(supabase)
    use_case = GetAutomationLogsUseCase(automations_repository)

    try:
        return await use_case.execute(automation_id, account_id, limit=limit, offset=offset)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
