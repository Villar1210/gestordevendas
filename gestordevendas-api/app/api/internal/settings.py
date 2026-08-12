"""Endpoints para Settings Module (Task 5)"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.settings_schemas import (
    TenantSettingsUpdate,
    TenantSettingsResponse,
)
from app.application.settings.use_cases import (
    GetSettingsUseCase,
    UpdateSettingsUseCase,
)
from app.infra.supabase.settings_repository import SettingsRepository

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/", response_model=TenantSettingsResponse, summary="Obter configurações")
async def get_settings(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter todas as configurações do tenant"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou ausente",
        )

    settings_repository = SettingsRepository(supabase)
    use_case = GetSettingsUseCase(settings_repository)
    return await use_case.execute(account_id)


@router.patch("/", response_model=TenantSettingsResponse, summary="Atualizar configurações")
async def update_settings(
    settings_update: TenantSettingsUpdate,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Atualizar configurações do tenant (parcial ou completo)"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou ausente",
        )

    settings_repository = SettingsRepository(supabase)
    use_case = UpdateSettingsUseCase(settings_repository)
    return await use_case.execute(account_id, settings_update)
