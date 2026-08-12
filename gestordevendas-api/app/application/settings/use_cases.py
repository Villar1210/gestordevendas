"""Use cases para Settings Module (Task 5)"""
from typing import Optional
from app.api.internal.settings_schemas import (
    GeneralSettings,
    FeatureFlags,
    QuotaSettings,
    NotificationSettings,
    SecuritySettings,
    TenantSettingsUpdate,
    TenantSettingsResponse,
)


class GetSettingsUseCase:
    """Obter configurações do tenant"""

    def __init__(self, settings_repository):
        self.settings_repository = settings_repository

    async def execute(self, account_id: str) -> TenantSettingsResponse:
        """Obter configurações ou criar padrão se não existir"""
        settings = await self.settings_repository.get_settings(account_id)

        if not settings:
            settings = await self.settings_repository.create_default_settings(
                account_id
            )

        return TenantSettingsResponse(
            id=settings.get("id"),
            account_id=settings.get("account_id"),
            general=GeneralSettings(
                company_name=settings.get("company_name"),
                company_logo_url=settings.get("company_logo_url"),
                theme=settings.get("theme", "light"),
                language=settings.get("language", "pt-BR"),
                timezone=settings.get("timezone", "America/Sao_Paulo"),
            ),
            features=FeatureFlags(
                enable_whatsapp=settings.get("enable_whatsapp", True),
                enable_email=settings.get("enable_email", True),
                enable_sms=settings.get("enable_sms", False),
                enable_analytics=settings.get("enable_analytics", True),
                enable_ai=settings.get("enable_ai", False),
            ),
            quota=QuotaSettings(
                max_users=settings.get("max_users", 10),
                max_contacts=settings.get("max_contacts", 1000),
                max_storage_gb=settings.get("max_storage_gb", 5),
            ),
            notifications=NotificationSettings(
                notify_new_lead=settings.get("notify_new_lead", True),
                notify_deal_won=settings.get("notify_deal_won", True),
                notify_team_activity=settings.get("notify_team_activity", False),
            ),
            security=SecuritySettings(
                require_2fa=settings.get("require_2fa", False),
                api_key_rotation_days=settings.get("api_key_rotation_days", 90),
                session_timeout_minutes=settings.get("session_timeout_minutes", 60),
            ),
            created_at=settings.get("created_at"),
            updated_at=settings.get("updated_at"),
        )


class UpdateSettingsUseCase:
    """Atualizar configurações do tenant"""

    def __init__(self, settings_repository):
        self.settings_repository = settings_repository

    async def execute(
        self, account_id: str, update_data: TenantSettingsUpdate
    ) -> TenantSettingsResponse:
        """Atualizar configurações parcialmente"""
        if update_data.general:
            await self.settings_repository.update_general_settings(
                account_id,
                company_name=update_data.general.company_name,
                company_logo_url=update_data.general.company_logo_url,
                theme=update_data.general.theme,
                language=update_data.general.language,
                timezone=update_data.general.timezone,
            )

        if update_data.features:
            await self.settings_repository.update_feature_flags(
                account_id,
                enable_whatsapp=update_data.features.enable_whatsapp,
                enable_email=update_data.features.enable_email,
                enable_sms=update_data.features.enable_sms,
                enable_analytics=update_data.features.enable_analytics,
                enable_ai=update_data.features.enable_ai,
            )

        if update_data.quota:
            await self.settings_repository.update_quota_settings(
                account_id,
                max_users=update_data.quota.max_users,
                max_contacts=update_data.quota.max_contacts,
                max_storage_gb=update_data.quota.max_storage_gb,
            )

        if update_data.security:
            await self.settings_repository.update_security_settings(
                account_id,
                require_2fa=update_data.security.require_2fa,
                api_key_rotation_days=update_data.security.api_key_rotation_days,
                session_timeout_minutes=update_data.security.session_timeout_minutes,
            )

        get_settings_use_case = GetSettingsUseCase(self.settings_repository)
        return await get_settings_use_case.execute(account_id)
