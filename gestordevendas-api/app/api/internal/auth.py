"""
Router interno: /api/auth  e  /api/team

Rotas:
    GET    /api/auth/me                    — perfil do usuário logado
    PATCH  /api/auth/me                    — atualizar nome/avatar
    POST   /api/auth/register              — criar nova conta (público, sem JWT)

    GET    /api/team                       — listar membros da equipe (admin+)
    POST   /api/team/invite                — convidar membro (admin+)
    PATCH  /api/team/{user_id}/role        — trocar role (owner only)
    DELETE /api/team/{user_id}             — remover membro (owner+admin sobre agent/viewer)
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from app.core.dependencies import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_owner,
)
from app.core.rate_limit import limiter, STRICT_LIMIT
from app.core.supabase import get_supabase_admin
from app.domain.enums import Role

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["Auth & Team"])

# ─── Schemas ─────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=120)
    full_name: str    = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str     = Field(..., min_length=8)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    avatar_url: Optional[str] = None


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=120)
    role: str = Field("agent", pattern="^(admin|agent|viewer)$")


class UpdateRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(admin|agent|viewer)$")


# ─── Auth ────────────────────────────────────────────────────────────────────

@router.get("/auth/me", summary="Perfil do usuário autenticado")
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """
    Retorna o perfil completo do usuário logado junto com dados da conta/plano.
    O frontend usa este endpoint logo após o login para hidratar o store.
    """
    db = get_supabase_admin()

    # Busca dados do account (nome da empresa + plano)
    acc_result = (
        db.table("accounts")
        .select("id, name, plan, subscription_status, trial_ends_at")
        .eq("id", user.account_id)
        .maybe_single()
        .execute()
    )
    account = acc_result.data or {}

    # Busca full_name e avatar_url do profile
    prof_result = (
        db.table("profiles")
        .select("full_name, avatar_url, created_at")
        .eq("id", user.user_id)
        .maybe_single()
        .execute()
    )
    profile = prof_result.data or {}

    return {
        "id": user.user_id,
        "email": user.email,
        "full_name": profile.get("full_name"),
        "avatar_url": profile.get("avatar_url"),
        "role": user.role.value,
        "created_at": profile.get("created_at"),
        "account_id": user.account_id,
        "account": {
            "id": account.get("id"),
            "name": account.get("name"),
            "plan": account.get("plan", "free"),
            "subscription_status": account.get("subscription_status", "active"),
            "trial_ends_at": account.get("trial_ends_at"),
        },
    }


@router.patch("/auth/me", summary="Atualizar perfil próprio")
async def update_me(
    body: UpdateProfileRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Atualiza nome e/ou avatar_url do usuário logado."""
    db = get_supabase_admin()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")

    db.table("profiles").update(updates).eq("id", user.user_id).execute()
    return {"ok": True, "updated": list(updates.keys())}


@router.post(
    "/auth/register",
    summary="Criar nova conta (signup público)",
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(STRICT_LIMIT)           # 10 tentativas/minuto por IP
async def register(request: Request, body: RegisterRequest):
    """
    Endpoint público — não requer JWT.
    Cria: Supabase Auth user + account (tenant) + profile com role=owner.
    O frontend deve fazer login normal após o registro.
    """
    db = get_supabase_admin()

    # 1. Verificar se email já existe (evitar erro genérico do Supabase)
    try:
        existing = db.auth.admin.list_users()
        emails = [u.email for u in existing if hasattr(u, "email")]
        if body.email in emails:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="E-mail já cadastrado.",
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Se não conseguir checar, deixar o Supabase rejeitar abaixo

    # 2. Criar usuário no Supabase Auth
    try:
        auth_result = db.auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,   # confirma automaticamente (sem link)
                "user_metadata": {"full_name": body.full_name},
            }
        )
    except Exception as e:
        err_msg = str(e).lower()
        if "already registered" in err_msg or "already exists" in err_msg:
            raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
        logger.error("register_auth_error", error=str(e))
        raise HTTPException(status_code=500, detail="Erro ao criar usuário.")

    user_id: str = auth_result.user.id

    # 3. Criar account (tenant)
    try:
        acc_result = (
            db.table("accounts")
            .insert({"name": body.company_name})
            .execute()
        )
        account_id: str = acc_result.data[0]["id"]
    except Exception as e:
        # Rollback: apagar o auth user criado
        try:
            db.auth.admin.delete_user(user_id)
        except Exception:
            pass
        logger.error("register_account_error", error=str(e))
        raise HTTPException(status_code=500, detail="Erro ao criar workspace.")

    # 4. Criar profile com role=owner
    try:
        db.table("profiles").insert(
            {
                "id": user_id,
                "account_id": account_id,
                "full_name": body.full_name,
                "role": "owner",
            }
        ).execute()
    except Exception as e:
        logger.error("register_profile_error", error=str(e))
        raise HTTPException(status_code=500, detail="Erro ao criar perfil.")

    logger.info("account_registered", account_id=account_id, email=body.email)
    return {
        "ok": True,
        "message": "Conta criada com sucesso. Faça login para continuar.",
        "account_id": account_id,
    }


# ─── Team management ─────────────────────────────────────────────────────────

@router.get("/team", summary="Listar membros da equipe")
async def list_team(user: CurrentUser = Depends(require_admin)):
    """
    Retorna todos os profiles do mesmo account com email de cada um.
    Disponível para admin e owner.
    """
    db = get_supabase_admin()

    # Busca profiles do account
    prof_result = (
        db.table("profiles")
        .select("id, full_name, avatar_url, role, created_at")
        .eq("account_id", user.account_id)
        .order("created_at")
        .execute()
    )
    profiles = prof_result.data or []

    if not profiles:
        return []

    # Busca emails dos usuários via admin API em lote
    user_ids = [p["id"] for p in profiles]
    emails_map: dict[str, str] = {}
    try:
        auth_users = db.auth.admin.list_users()
        for au in auth_users:
            uid = str(au.id) if hasattr(au, "id") else None
            email = au.email if hasattr(au, "email") else None
            if uid and uid in user_ids and email:
                emails_map[uid] = email
    except Exception as e:
        logger.warning("team_list_emails_failed", error=str(e))

    return [
        {
            "id": p["id"],
            "email": emails_map.get(p["id"], ""),
            "full_name": p.get("full_name"),
            "avatar_url": p.get("avatar_url"),
            "role": p["role"],
            "created_at": p.get("created_at"),
            "is_current_user": p["id"] == user.user_id,
        }
        for p in profiles
    ]


@router.post("/team/invite", summary="Convidar membro para a equipe", status_code=201)
async def invite_member(
    body: InviteRequest,
    user: CurrentUser = Depends(require_admin),
):
    """
    Envia convite por e-mail via Supabase Auth.
    Cria o profile com a role especificada; o usuário define a senha pelo link.
    Owner não pode ser convidado — apenas criado via /auth/register.
    """
    db = get_supabase_admin()

    # Envia invite via Supabase (magic link de definição de senha)
    try:
        invite_result = db.auth.admin.invite_user_by_email(
            body.email,
            options={"data": {"full_name": body.full_name}},
        )
    except Exception as e:
        err_msg = str(e).lower()
        if "already registered" in err_msg or "already exists" in err_msg:
            raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
        logger.error("invite_error", error=str(e))
        raise HTTPException(status_code=500, detail="Erro ao enviar convite.")

    invited_user_id: str = invite_result.user.id

    # Cria profile já vinculado ao account
    try:
        db.table("profiles").insert(
            {
                "id": invited_user_id,
                "account_id": user.account_id,
                "full_name": body.full_name,
                "role": body.role,
            }
        ).execute()
    except Exception as e:
        logger.error("invite_profile_error", error=str(e))
        raise HTTPException(status_code=500, detail="Erro ao criar perfil do convidado.")

    logger.info(
        "member_invited",
        account_id=user.account_id,
        invited_email=body.email,
        role=body.role,
        by=user.user_id,
    )
    return {
        "ok": True,
        "message": f"Convite enviado para {body.email}.",
        "user_id": invited_user_id,
    }


@router.patch("/team/{member_id}/role", summary="Trocar role de um membro (owner only)")
async def update_member_role(
    member_id: str,
    body: UpdateRoleRequest,
    user: CurrentUser = Depends(require_owner),
):
    """
    Apenas o owner pode trocar roles.
    Não é possível trocar a própria role nem a role de outro owner.
    """
    if member_id == user.user_id:
        raise HTTPException(status_code=400, detail="Não é possível alterar a própria role.")

    db = get_supabase_admin()

    # Verifica que o membro pertence ao mesmo account
    prof = (
        db.table("profiles")
        .select("role")
        .eq("id", member_id)
        .eq("account_id", user.account_id)
        .maybe_single()
        .execute()
    )
    if not prof.data:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")

    if prof.data["role"] == "owner":
        raise HTTPException(status_code=403, detail="Não é possível alterar a role de outro owner.")

    db.table("profiles").update({"role": body.role}).eq("id", member_id).execute()

    logger.info(
        "member_role_updated",
        account_id=user.account_id,
        member_id=member_id,
        new_role=body.role,
        by=user.user_id,
    )
    return {"ok": True, "member_id": member_id, "role": body.role}


@router.delete("/team/{member_id}", summary="Remover membro da equipe", status_code=200)
async def remove_member(
    member_id: str,
    user: CurrentUser = Depends(require_admin),
):
    """
    Remove o profile (desvincula do account) e desativa o auth user.
    Owner não pode ser removido. Apenas owner pode remover admins.
    """
    if member_id == user.user_id:
        raise HTTPException(status_code=400, detail="Não é possível remover a si mesmo.")

    db = get_supabase_admin()

    prof = (
        db.table("profiles")
        .select("role")
        .eq("id", member_id)
        .eq("account_id", user.account_id)
        .maybe_single()
        .execute()
    )
    if not prof.data:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")

    target_role = prof.data["role"]
    if target_role == "owner":
        raise HTTPException(status_code=403, detail="Owner não pode ser removido.")

    # Apenas owner pode remover admins
    if target_role == "admin" and user.role != Role.OWNER:
        raise HTTPException(
            status_code=403,
            detail="Somente o owner pode remover admins.",
        )

    # Remove o profile (desvincula do tenant)
    db.table("profiles").delete().eq("id", member_id).execute()

    # Desativa o auth user (não deleta — preserva histórico)
    try:
        db.auth.admin.update_user_by_id(
            member_id, {"ban_duration": "876600h"}  # ~100 anos = efetivamente banido
        )
    except Exception as e:
        logger.warning("remove_member_ban_failed", member_id=member_id, error=str(e))

    logger.info(
        "member_removed",
        account_id=user.account_id,
        member_id=member_id,
        by=user.user_id,
    )
    return {"ok": True, "removed": member_id}
