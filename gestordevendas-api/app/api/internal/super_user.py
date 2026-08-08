"""
Router interno: /api/super
Endpoints cross-tenant para Super Usuários.
Apenas usuários com role SUPER_ADMIN podem acessar.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.application.super_user.assume_admin_for_tenant_use_case import AssumeAdminForTenantUseCase
from app.application.super_user.get_platform_stats_use_case import GetPlatformStatsUseCase
from app.application.super_user.list_tenants_use_case import ListTenantsUseCase
from app.core.dependencies import CurrentUser, require_super_admin
from app.domain.entities import Account, PlatformStats

router = APIRouter(prefix="/super", tags=["Super Admin (Cross-Tenant)"])


class AssumeAdminRequest(BaseModel):
    """Request para assumir admin de um tenant."""
    expires_in_minutes: int = Field(default=60, ge=1, le=480)  # Min 1 min, máx 8 horas


# ─── GET /api/super/dashboard ───────────────────────────────────────────────

@router.get("/dashboard", summary="Dashboard cross-tenant da plataforma")
async def get_platform_dashboard(
    user: CurrentUser = Depends(require_super_admin),
) -> dict:
    """
    Retorna estatísticas globais da plataforma:
    - Total de tenants
    - Total de usuários
    - Total de contatos
    - Total de conversas
    - Distribuição de planos

    Acesso restrito a Super Usuários.
    """
    uc = GetPlatformStatsUseCase(
        is_super_user=(user.role.value == "super_admin"),
        super_usuario_id=user.user_id,
    )
    stats: PlatformStats = uc.execute()

    return {
        "status": "success",
        "data": {
            "total_accounts": stats.total_accounts,
            "total_profiles": stats.total_profiles,
            "total_contacts": stats.total_contacts,
            "total_conversations": stats.total_conversations,
            "active_accounts_today": stats.active_accounts_today,
            "plans_breakdown": stats.plans_breakdown,
            "generated_at": stats.generated_at.isoformat(),
        },
    }


# ─── GET /api/super/tenants ─────────────────────────────────────────────────

@router.get("/tenants", summary="Lista todos os tenants da plataforma")
async def list_tenants(
    user: CurrentUser = Depends(require_super_admin),
    limit: int = 1000,
) -> dict:
    """
    Lista todos os tenants (Accounts) da plataforma com suas informações.

    Cada tenant inclui:
    - ID
    - Nome
    - Proprietário (owner_id)
    - Plano (free/pro/enterprise)
    - Data de criação

    Acesso restrito a Super Usuários.
    """
    uc = ListTenantsUseCase(
        is_super_user=(user.role.value == "super_admin"),
        super_usuario_id=user.user_id,
    )
    accounts: list[Account] = uc.execute(limit=limit)

    return {
        "status": "success",
        "data": [
            {
                "id": acc.id,
                "name": acc.name,
                "owner_id": acc.owner_id,
                "plan": acc.plan.value,
                "created_at": acc.created_at.isoformat() if acc.created_at else None,
            }
            for acc in accounts
        ],
        "count": len(accounts),
    }


# ─── POST /api/super/tenants/:account_id/assume-admin ──────────────────────

@router.post(
    "/tenants/{account_id}/assume-admin",
    summary="Assumir admin de um tenant (gerar token temporário)",
)
async def assume_admin_for_tenant(
    account_id: str,
    body: AssumeAdminRequest,
    user: CurrentUser = Depends(require_super_admin),
) -> dict:
    """
    Gera um JWT temporário que permite ao Super Usuário atuar como admin
    do tenant especificado por 1 hora (ou tempo configurado).

    Usado para:
    - Suporte e auditoria a um tenant específico
    - Debug de problemas
    - Administração delegada

    O token inclui:
    - Role elevada a "super_admin"
    - Account ID do tenant específico
    - Expiração em 1 hora (ou tempo solicitado)

    Acesso restrito a Super Usuários.
    """
    uc = AssumeAdminForTenantUseCase(
        is_super_user=(user.role.value == "super_admin"),
        super_usuario_id=user.user_id,
    )
    result = uc.execute(
        account_id=account_id,
        expires_in_minutes=body.expires_in_minutes,
    )

    return {
        "status": "success",
        "data": result,
    }
