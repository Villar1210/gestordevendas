"""Repository para Tenant Settings"""
from typing import Optional


class SettingsRepository:
    """Gerenciar configurações do tenant"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def get_settings(self, account_id: str) -> Optional[dict]:
        """Obter configurações do tenant"""
        result = await self.supabase.table("tenant_settings").select("*").eq(
            "account_id", account_id
        ).execute()

        return result.data[0] if result.data else None

    async def create_default_settings(self, account_id: str) -> dict:
        """Criar configurações padrão para novo tenant"""
        result = await self.supabase.table("tenant_settings").insert({
            "account_id": account_id,
            "company_name": "My Company",
            "theme": "light",
            "language": "pt-BR",
            "timezone": "America/Sao_Paulo",
        }).execute()

        return result.data[0] if result.data else None

    async def update_general_settings(
        self,
        account_id: str,
        company_name: Optional[str] = None,
        company_logo_url: Optional[str] = None,
        theme: Optional[str] = None,
        language: Optional[str] = None,
        timezone: Optional[str] = None,
    ) -> dict:
        """Atualizar configurações gerais"""
        update_data = {}
        if company_name is not None:
            update_data["company_name"] = company_name
        if company_logo_url is not None:
            update_data["company_logo_url"] = company_logo_url
        if theme is not None:
            update_data["theme"] = theme
        if language is not None:
            update_data["language"] = language
        if timezone is not None:
            update_data["timezone"] = timezone

        result = await self.supabase.table("tenant_settings").update(
            update_data
        ).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def update_feature_flags(
        self,
        account_id: str,
        enable_whatsapp: Optional[bool] = None,
        enable_email: Optional[bool] = None,
        enable_sms: Optional[bool] = None,
        enable_analytics: Optional[bool] = None,
        enable_ai: Optional[bool] = None,
    ) -> dict:
        """Atualizar feature flags"""
        update_data = {}
        if enable_whatsapp is not None:
            update_data["enable_whatsapp"] = enable_whatsapp
        if enable_email is not None:
            update_data["enable_email"] = enable_email
        if enable_sms is not None:
            update_data["enable_sms"] = enable_sms
        if enable_analytics is not None:
            update_data["enable_analytics"] = enable_analytics
        if enable_ai is not None:
            update_data["enable_ai"] = enable_ai

        result = await self.supabase.table("tenant_settings").update(
            update_data
        ).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def update_quota_settings(
        self,
        account_id: str,
        max_users: Optional[int] = None,
        max_contacts: Optional[int] = None,
        max_storage_gb: Optional[int] = None,
    ) -> dict:
        """Atualizar configurações de quota"""
        update_data = {}
        if max_users is not None:
            update_data["max_users"] = max_users
        if max_contacts is not None:
            update_data["max_contacts"] = max_contacts
        if max_storage_gb is not None:
            update_data["max_storage_gb"] = max_storage_gb

        result = await self.supabase.table("tenant_settings").update(
            update_data
        ).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def update_security_settings(
        self,
        account_id: str,
        require_2fa: Optional[bool] = None,
        api_key_rotation_days: Optional[int] = None,
        session_timeout_minutes: Optional[int] = None,
    ) -> dict:
        """Atualizar configurações de segurança"""
        update_data = {}
        if require_2fa is not None:
            update_data["require_2fa"] = require_2fa
        if api_key_rotation_days is not None:
            update_data["api_key_rotation_days"] = api_key_rotation_days
        if session_timeout_minutes is not None:
            update_data["session_timeout_minutes"] = session_timeout_minutes

        result = await self.supabase.table("tenant_settings").update(
            update_data
        ).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None
