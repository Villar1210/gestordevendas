"""
Router interno: /api/conversations/{conversation_id}/messages
"""
from __future__ import annotations

import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.internal.schemas import MessageOut, MessageSend
from app.application.conversations.messages_use_cases import (
    ListMessagesUseCase,
    SendMessageUseCase,
)
from app.core.dependencies import CurrentUser, get_current_user, require_agent

# Prefixo inclui conversation_id — registrado no router de conversations
router = APIRouter(tags=["Messages"])


@router.get(
    "/conversations/{conversation_id}/messages",
    summary="Listar mensagens de uma conversa",
)
async def list_messages(
    conversation_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    before: Optional[datetime.datetime] = Query(
        None,
        description="Retorna mensagens anteriores a esta data (cursor para paginação reversa)",
    ),
    user: CurrentUser = Depends(get_current_user),
):
    uc = ListMessagesUseCase(user.account_id)
    return uc.execute(conversation_id, page=page, per_page=per_page, before=before)


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=status.HTTP_201_CREATED,
    summary="Enviar mensagem",
)
async def send_message(
    conversation_id: UUID,
    body: MessageSend,
    user: CurrentUser = Depends(require_agent),
):
    uc = SendMessageUseCase(user.account_id)
    return uc.execute(
        conversation_id,
        content=body.content,
        message_type=body.message_type,
        sender_id=user.user_id,
        media_url=body.media_url,
        template_name=body.template_name,
        template_params=body.template_params,
    )
