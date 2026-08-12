"""Schemas para Account Management (Task 3, Fase 5)"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserProfileResponse(BaseModel):
    """Perfil do usuário"""
    id: str
    account_id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    """Atualizar perfil"""
    name: str = Field(..., min_length=1, max_length=255)
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    """Trocar senha"""
    current_password: str
    new_password: str = Field(..., min_length=8)

    model_config = {"from_attributes": True}


class TeamMemberResponse(BaseModel):
    """Membro da equipe"""
    id: str
    email: str
    name: str
    role: str  # owner, admin, member
    status: str  # active, invited, inactive
    joined_at: Optional[str] = None
    invited_at: Optional[str] = None

    model_config = {"from_attributes": True}


class InviteTeamMemberRequest(BaseModel):
    """Convidar membro da equipe"""
    email: EmailStr
    role: str = Field(..., pattern="^(admin|member)$")  # owner is not allowed

    model_config = {"from_attributes": True}


class UpdateTeamMemberRequest(BaseModel):
    """Atualizar role de membro"""
    role: str = Field(..., pattern="^(admin|member)$")

    model_config = {"from_attributes": True}


class AccountSettingsResponse(BaseModel):
    """Configurações da conta"""
    account_id: str
    company_name: str
    billing_email: Optional[str] = None
    timezone: str = "America/Sao_Paulo"
    language: str = "pt-BR"
    notifications_email: bool = True
    notifications_sms: bool = False

    model_config = {"from_attributes": True}


class UpdateAccountSettingsRequest(BaseModel):
    """Atualizar configurações"""
    company_name: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    notifications_email: Optional[bool] = None
    notifications_sms: Optional[bool] = None

    model_config = {"from_attributes": True}


class DeleteAccountRequest(BaseModel):
    """Deletar conta"""
    confirmation_text: str = Field(..., pattern="^DELETE MY ACCOUNT$")

    model_config = {"from_attributes": True}
