"""Endpoints para Account Management (Task 3, Fase 5)"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.account_schemas import (
    UserProfileResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
    TeamMemberResponse,
    InviteTeamMemberRequest,
    UpdateTeamMemberRequest,
    AccountSettingsResponse,
    UpdateAccountSettingsRequest,
    DeleteAccountRequest,
)

router = APIRouter(prefix="/account", tags=["Account"])


@router.get("/profile", response_model=UserProfileResponse, summary="Perfil do usuário")
async def get_profile(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter perfil do usuário logado"""
    account_id = token.get("account_id")
    user_id = token.get("user_id")
    if not account_id or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Buscar perfil do banco

    return UserProfileResponse(
        id=user_id,
        account_id=account_id,
        email=token.get("email", ""),
        name="User Name",
        avatar_url=None,
        created_at="2026-01-01T00:00:00Z",
    )


@router.patch("/profile", response_model=UserProfileResponse, summary="Atualizar perfil")
async def update_profile(
    request: UpdateProfileRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Atualizar perfil do usuário"""
    account_id = token.get("account_id")
    user_id = token.get("user_id")
    if not account_id or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Atualizar perfil no banco

    return UserProfileResponse(
        id=user_id,
        account_id=account_id,
        email=token.get("email", ""),
        name=request.name,
        avatar_url=request.avatar_url,
        created_at="2026-01-01T00:00:00Z",
    )


@router.post("/change-password", summary="Trocar senha")
async def change_password(
    request: ChangePasswordRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Trocar senha do usuário"""
    account_id = token.get("account_id")
    user_id = token.get("user_id")
    if not account_id or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Validar senha atual e trocar no banco

    return {"success": True, "message": "Senha alterada com sucesso"}


@router.get("/team", response_model=list[TeamMemberResponse], summary="Listar membros")
async def list_team_members(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Listar membros da equipe"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Buscar membros do banco

    return []


@router.post("/team/invite", response_model=TeamMemberResponse, summary="Convidar membro")
async def invite_team_member(
    request: InviteTeamMemberRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Convidar novo membro para a equipe"""
    account_id = token.get("account_id")
    user_role = token.get("role")
    if not account_id or user_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas proprietário pode convidar",
        )

    # TODO: Criar convite e enviar e-mail

    return TeamMemberResponse(
        id=f"invited_{request.email}",
        email=request.email,
        name="",
        role=request.role,
        status="invited",
        joined_at=None,
        invited_at="2026-08-11T00:00:00Z",
    )


@router.patch("/team/{member_id}", response_model=TeamMemberResponse, summary="Atualizar membro")
async def update_team_member(
    member_id: str,
    request: UpdateTeamMemberRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Atualizar role de membro da equipe"""
    account_id = token.get("account_id")
    user_role = token.get("role")
    if not account_id or user_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas proprietário pode atualizar",
        )

    # TODO: Atualizar role no banco

    return TeamMemberResponse(
        id=member_id,
        email="member@example.com",
        name="Member Name",
        role=request.role,
        status="active",
        joined_at="2026-08-11T00:00:00Z",
        invited_at=None,
    )


@router.delete("/team/{member_id}", summary="Remover membro")
async def remove_team_member(
    member_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Remover membro da equipe"""
    account_id = token.get("account_id")
    user_role = token.get("role")
    if not account_id or user_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas proprietário pode remover",
        )

    # TODO: Remover membro do banco

    return {"success": True, "message": "Membro removido"}


@router.get("/settings", response_model=AccountSettingsResponse, summary="Configurações")
async def get_account_settings(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter configurações da conta"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Buscar configurações do banco

    return AccountSettingsResponse(
        account_id=account_id,
        company_name="My Company",
        billing_email=token.get("email", ""),
        timezone="America/Sao_Paulo",
        language="pt-BR",
        notifications_email=True,
        notifications_sms=False,
    )


@router.patch("/settings", response_model=AccountSettingsResponse, summary="Atualizar configurações")
async def update_account_settings(
    request: UpdateAccountSettingsRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Atualizar configurações da conta"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Atualizar configurações no banco

    return AccountSettingsResponse(
        account_id=account_id,
        company_name=request.company_name or "My Company",
        billing_email=token.get("email", ""),
        timezone=request.timezone or "America/Sao_Paulo",
        language=request.language or "pt-BR",
        notifications_email=request.notifications_email if request.notifications_email is not None else True,
        notifications_sms=request.notifications_sms if request.notifications_sms is not None else False,
    )


@router.delete("", summary="Deletar conta")
async def delete_account(
    request: DeleteAccountRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Deletar conta (permanentemente)"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        )

    # TODO: Deletar conta e todos os dados associados em cascata

    return {
        "success": True,
        "message": "Conta deletada permanentemente",
    }
