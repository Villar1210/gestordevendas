"""
Use cases de Messages (dentro do contexto de conversas).
"""
from __future__ import annotations

import datetime
from typing import Optional
from uuid import UUID

import structlog

from app.infra.supabase.conversations_repo import ConversationsRepository
from app.infra.supabase.messages_repo import MessagesRepository

logger = structlog.get_logger(__name__)


class ListMessagesUseCase:
    def __init__(self, account_id: UUID):
        self._msgs = MessagesRepository(account_id)
        self._convs = ConversationsRepository(account_id)

    def execute(
        self,
        conversation_id: UUID,
        *,
        page: int = 1,
        per_page: int = 50,
        before: Optional[datetime.datetime] = None,
    ) -> dict:
        # Valida que a conversa existe e pertence ao tenant
        self._convs.get_by_id(conversation_id)

        items, total = self._msgs.list_by_conversation(
            conversation_id,
            page=page,
            per_page=per_page,
            before=before,
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (page * per_page) < total,
        }


class SendMessageUseCase:
    """
    Registra a mensagem no banco e coloca na fila de envio (Celery).
    O envio real via Meta Cloud API é feito pelo worker (Fase 3).
    Por ora: salva com status='queued' e loga.
    """

    def __init__(self, account_id: UUID):
        self._account_id = account_id  # necessário para enfileirar no Celery (linha ~99)
        self._msgs = MessagesRepository(account_id)
        self._convs = ConversationsRepository(account_id)

    def execute(
        self,
        conversation_id: UUID,
        *,
        content: str,
        message_type: str = "text",
        sender_id: Optional[UUID] = None,
        media_url: Optional[str] = None,
        template_name: Optional[str] = None,
        template_params: Optional[list[str]] = None,
    ) -> dict:
        # Valida conversa + tenant
        conv = self._convs.get_by_id(conversation_id)

        # Persiste com status 'queued' (será atualizado pelo worker após envio)
        msg = self._msgs.create(
            conversation_id=conversation_id,
            content=content,
            message_type=message_type,
            direction="outbound",
            sender_id=sender_id,
            media_url=media_url,
            status="queued",
            template_name=template_name,
            template_params=template_params,
        )

        # Atualiza preview da conversa
        self._convs.mark_message_received(
            conversation_id,
            preview=content[:200] if content else f"[{message_type}]",
        )

        # Fase 3: enfileira para worker Meta API
        try:
            from app.workers.whatsapp import send_whatsapp_message
            send_whatsapp_message.delay(
                message_id=str(msg["id"]),
                conversation_id=str(conversation_id),
                account_id=str(self._account_id),
            )
        except Exception as e:
            # Worker não disponível (sem Redis/Celery em dev) — só loga
            logger.warning("celery_not_available", error=str(e))

        logger.info(
            "message_queued",
            message_id=str(msg.get("id")),
            conversation_id=str(conversation_id),
            message_type=message_type,
        )
        return msg


class ReceiveInboundMessageUseCase:
    """
    Chamado pelo webhook do WhatsApp (Fase 3).
    Registra mensagem inbound e atualiza a conversa.
    """

    def __init__(self, account_id: UUID):
        self._msgs = MessagesRepository(account_id)
        self._convs = ConversationsRepository(account_id)

    def execute(
        self,
        conversation_id: UUID,
        *,
        content: str,
        message_type: str = "text",
        wa_message_id: Optional[str] = None,
        media_url: Optional[str] = None,
    ) -> dict:
        msg = self._msgs.create(
            conversation_id=conversation_id,
            content=content,
            message_type=message_type,
            direction="inbound",
            wa_message_id=wa_message_id,
            media_url=media_url,
            status="delivered",
        )

        self._convs.mark_message_received(
            conversation_id,
            preview=content[:200] if content else f"[{message_type}]",
        )

        return msg
