"""Schemas para Settings Module (Task 5)"""
from pydantic import BaseModel, Field
from typing import Optional


class GeneralSettings(BaseModel):
    """Configurações gerais"""
    company_name: Optional[str] = Field(None, max_length=255)
    company_logo_url: Optional[str] = None
    theme: str = Field(default="light", pattern="^(light|dark|auto)$")
    language: str = Field(default="pt-BR")
    timezone: str = Field(default="America/Sao_Paulo")

    model_config = {"from_attributes": True}


class FeatureFlags(BaseModel):
    """Feature flags"""
    enable_whatsapp: bool = True
    enable_email: bool = True
    enable_sms: bool = False
    enable_analytics: bool = True
    enable_ai: bool = False

    model_config = {"from_attributes": True}


class QuotaSettings(BaseModel):
    """Quotas e limites"""
    max_users: int = Field(default=10, ge=1, le=1000)
    max_contacts: int = Field(default=1000, ge=1, le=100000)
    max_storage_gb: int = Field(default=5, ge=1, le=1000)

    model_config = {"from_attributes": True}


class NotificationSettings(BaseModel):
    """Configurações de notificação"""
    notify_new_lead: bool = True
    notify_deal_won: bool = True
    notify_team_activity: bool = False

    model_config = {"from_attributes": True}


class SecuritySettings(BaseModel):
    """Configurações de segurança"""
    require_2fa: bool = False
    api_key_rotation_days: int = Field(default=90, ge=1, le=365)
    session_timeout_minutes: int = Field(default=60, ge=5, le=1440)

    model_config = {"from_attributes": True}


class TenantSettingsUpdate(BaseModel):
    """Atualizar configurações do tenant"""
    general: Optional[GeneralSettings] = None
    features: Optional[FeatureFlags] = None
    quota: Optional[QuotaSettings] = None
    notifications: Optional[NotificationSettings] = None
    security: Optional[SecuritySettings] = None

    model_config = {"from_attributes": True}


class TenantSettingsResponse(BaseModel):
    """Resposta completa de configurações"""
    id: str
    account_id: str
    general: GeneralSettings
    features: FeatureFlags
    quota: QuotaSettings
    notifications: NotificationSettings
    security: SecuritySettings
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}
