"""Endpoints para Broadcasts Module (Task 3, Fase 3)"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.broadcasts_schemas import (
    BroadcastCreate,
    BroadcastUpdate,
    BroadcastResponse,
    BroadcastStats,
)
from app.infra.supabase.broadcasts_repository import BroadcastsRepository

router = APIRouter(prefix="/broadcasts", tags=["Broadcasts"])


@router.post("/", response_model=BroadcastResponse, status_code=status.HTTP_201_CREATED, summary="Criar broadcast")
async def create_broadcast(
    broadcast_data: BroadcastCreate,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Criar novo broadcast"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = BroadcastsRepository(supabase)
    broadcast = await repo.create_broadcast(
        account_id=account_id,
        name=broadcast_data.name,
        message_template_id=broadcast_data.message_template_id,
        recipient_filter=broadcast_data.recipient_filter,
        scheduled_at=broadcast_data.scheduled_at.isoformat() if broadcast_data.scheduled_at else None,
    )

    if not broadcast:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Erro ao criar broadcast")

    return BroadcastResponse(**broadcast)


@router.get("/", summary="Listar broadcasts")
async def list_broadcasts(
    limit: int = 20,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Listar broadcasts do tenant"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = BroadcastsRepository(supabase)
    broadcasts, total = await repo.get_broadcasts(account_id, limit=limit, offset=offset)

    return {
        "broadcasts": [BroadcastResponse(**b) for b in broadcasts],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{broadcast_id}", response_model=BroadcastResponse, summary="Obter broadcast")
async def get_broadcast(
    broadcast_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter broadcast específico"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = BroadcastsRepository(supabase)
    broadcast = await repo.get_broadcast(broadcast_id, account_id)

    if not broadcast:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast não encontrado")

    return BroadcastResponse(**broadcast)


@router.patch("/{broadcast_id}", response_model=BroadcastResponse, summary="Atualizar broadcast")
async def update_broadcast(
    broadcast_id: str,
    broadcast_data: BroadcastUpdate,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Atualizar broadcast"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = BroadcastsRepository(supabase)
    update_data = broadcast_data.model_dump(exclude_none=True)
    if "scheduled_at" in update_data and update_data["scheduled_at"]:
        update_data["scheduled_at"] = update_data["scheduled_at"].isoformat()

    broadcast = await repo.update_broadcast(broadcast_id, account_id, **update_data)

    if not broadcast:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast não encontrado")

    return BroadcastResponse(**broadcast)


@router.delete("/{broadcast_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deletar broadcast")
async def delete_broadcast(
    broadcast_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Deletar broadcast"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = BroadcastsRepository(supabase)
    success = await repo.delete_broadcast(broadcast_id, account_id)

    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast não encontrado")


@router.post("/{broadcast_id}/send", summary="Enviar broadcast agora")
async def send_broadcast_now(
    broadcast_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Enviar broadcast imediatamente (não agendado)"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = BroadcastsRepository(supabase)
    broadcast = await repo.get_broadcast(broadcast_id, account_id)

    if not broadcast:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast não encontrado")

    if broadcast["status"] != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broadcast já foi enviado")

    # Iniciar envio (em produção, isso seria uma task Celery)
    await repo.update_broadcast(broadcast_id, account_id, status="in_progress", started_at="NOW()")

    return {"message": "Envio iniciado", "broadcast_id": broadcast_id}


@router.get("/{broadcast_id}/stats", response_model=BroadcastStats, summary="Obter estatísticas")
async def get_broadcast_stats(
    broadcast_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter estatísticas de envio"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = BroadcastsRepository(supabase)
    broadcast = await repo.get_broadcast(broadcast_id, account_id)

    if not broadcast:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broadcast não encontrado")

    total = broadcast["total_recipients"]
    sent = broadcast["sent_count"]
    failed = broadcast["failed_count"]
    pending = total - sent - failed

    success_rate = (sent / total * 100) if total > 0 else 0

    return BroadcastStats(
        broadcast_id=broadcast_id,
        total=total,
        sent=sent,
        failed=failed,
        pending=pending,
        success_rate=success_rate,
    )
