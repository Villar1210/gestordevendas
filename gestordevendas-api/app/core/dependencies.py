"""
FastAPI Dependencies compartilhadas.

Uso nos endpoints:
    current_user: CurrentUser = Depends(get_current_user)
    admin_user:   CurrentUser = Depends(require_admin)
"""
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status

from app.core.security import get_claims_from_token, get_raw_token, get_user_id_from_token, hash_api_key
from app.core.supabase import get_supabase_admin
from app.domain.enums import Role
from app.domain.exceptions import ForbiddenError, UnauthorizedError


@dataclass
class CurrentUser:
    """Contexto do usuário autenticado por JWT Supabase."""
    user_id: str       # UUID do usuário (auth.users.id)
    account_id: str    # UUID da conta/workspace
    role: Role
    email: str

    # Compat com código legado que usava .id
    @property
    def id(self) -> str:
        return self.user_id


@dataclass
class ApiKeyContext:
    """Contexto de uma requisição autenticada por API Key."""
    key_id: str
    account_id: str
    scopes: list[str]


# ─── JWT: usuário do dashboard ────────────────────────────────────────────────

async def get_current_user(token: str = Depends(get_raw_token)) -> CurrentUser:
    """
    Autentica via JWT Supabase.
    Busca profile do usuário (account_id + role) no banco.
    Email vem do próprio JWT — sem chamada extra ao banco.
    """
    db = get_supabase_admin()
    try:
        claims = get_claims_from_token(token)
        user_id: str = claims.get("sub", "")
        if not user_id:
            raise UnauthorizedError("Token sem sub (user_id)")
        # O Supabase embute o email no JWT — evita round-trip extra ao banco
        email: str = claims.get("email", "")
    except UnauthorizedError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    result = (
        db.table("profiles")
        .select("id, account_id, role")   # coluna 'role', não 'account_role'
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou sem workspace associado",
        )

    data = result.data
    try:
        role = Role(data["role"])
    except (ValueError, KeyError):
        role = Role.VIEWER

    return CurrentUser(
        user_id=data["id"],
        account_id=data["account_id"],
        role=role,
        email=email,
    )


def require_role(min_role: Role):
    """
    Dependency factory: exige role mínima.

    Uso:
        user = Depends(require_role(Role.ADMIN))
    """
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not user.role.has_permission(min_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requer role '{min_role.value}' ou superior. Você tem '{user.role.value}'.",
            )
        return user
    return _check


def require_owner(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency: exige role OWNER."""
    if not user.role.has_permission(Role.OWNER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requer role OWNER. Você tem '{user.role.value}'.",
        )
    return user


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency: exige role ADMIN ou superior."""
    if not user.role.has_permission(Role.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requer role ADMIN. Você tem '{user.role.value}'.",
        )
    return user


async def require_super_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency: exige role SUPER_ADMIN (cross-tenant)."""
    if user.role != Role.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas Super Usuários podem acessar este endpoint.",
        )
        return user
    return _check


# Shortcuts: callables prontos para uso em Depends(require_agent) nos endpoints
require_agent = require_role(Role.AGENT)
require_admin  = require_role(Role.ADMIN)
require_owner  = require_role(Role.OWNER)


# ─── API Key: API Pública v1 ──────────────────────────────────────────────────

async def get_api_key_context(token: str = Depends(get_raw_token)) -> ApiKeyContext:
    """
    Autentica via API Key (Bearer wacrm_live_...).
    Verifica hash SHA-256 na tabela api_keys.
    """
    db = get_supabase_admin()
    key_hash = hash_api_key(token)

    result = (
        db.table("api_keys")
        .select("id, account_id, scopes, is_active")
        .eq("key_hash", key_hash)
        .maybe_single()
        .execute()
    )

    if not result.data or not result.data.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key inválida ou desativada",
        )

    # Atualiza last_used_at (sem bloquear a resposta)
    db.table("api_keys").update({"last_used_at": "now()"}).eq("id", result.data["id"]).execute()

    return ApiKeyContext(
        key_id=result.data["id"],
        account_id=result.data["account_id"],
        scopes=result.data.get("scopes", []),
    )


def require_scope(scope: str):
    """
    Dependency factory: exige escopo específico na API Key.

    Uso:
        ctx = Depends(require_scope("contacts:write"))
    """
    async def _check(ctx: ApiKeyContext = Depends(get_api_key_context)) -> ApiKeyContext:
        if scope not in ctx.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Escopo '{scope}' não autorizado para esta API Key",
            )
        return ctx
    return _check
