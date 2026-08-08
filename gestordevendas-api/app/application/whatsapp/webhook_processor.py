"""
Processador de eventos do webhook Meta WhatsApp.

Responsabilidades:
1. Parsear o payload bruto da Meta
2. Para cada mensagem recebida: get-or-create contact + conversation + registrar mensagem
3. Para eventos de status (delivered/read): atualizar status da mensagem no banco
4. Acionar worker de IA (Fase 5) se ai_enabled na conversa

Não faz HTTP nem conhece FastAPI — é pura lógica de aplicação.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.application.contacts.use_cases import GetOrCreateContactUseCase
from app.application.conversations.messages_use_cases import ReceiveInboundMessageUseCase
from app.infra.supabase.conversations_repo import ConversationsRepository
from app.infra.supabase.inboxes_repo import InboxesRepository
from app.infra.supabase.messages_repo import MessagesRepository

logger = structlog.get_logger(__name__)


class WebhookProcessor:
    """
    Stateless: instanciado por requisição, descartado após processar.
    account_id vem da inbox identificada pelo phone_number_id do payload.
    """

    def __init__(self, account_id: UUID, inbox_id: UUID):
        self._account_id = account_id
        self._inbox_id = inbox_id
        self._contacts_uc = GetOrCreateContactUseCase(account_id)
        self._convs_repo = ConversationsRepository(account_id)
        self._msgs_repo = MessagesRepository(account_id)
        self._inbound_uc = ReceiveInboundMessageUseCase(account_id)

    # ── Entry point ───────────────────────────────────────────────────────────

    def process(self, payload: dict) -> None:
        """
        Processa o payload completo do webhook Meta.
        Formato: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
        """
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                field = change.get("field", "")

                if field != "messages":
                    continue

                # Mensagens recebidas
                for msg in value.get("messages", []):
                    try:
                        self._handle_inbound_message(msg, value)
                    except Exception as e:
                        logger.error(
                            "webhook_message_error",
                            error=str(e),
                            wa_message_id=msg.get("id"),
                        )

                # Atualizações de status (delivered, read, failed)
                for status_update in value.get("statuses", []):
                    try:
                        self._handle_status_update(status_update)
                    except Exception as e:
                        logger.error(
                            "webhook_status_error",
                            error=str(e),
                            wa_message_id=status_update.get("id"),
                        )

    # ── Mensagem inbound ──────────────────────────────────────────────────────

    def _handle_inbound_message(self, msg: dict, value: dict) -> None:
        wa_message_id = msg.get("id")
        from_number = msg.get("from")   # número do remetente (E.164 sem +)
        msg_type = msg.get("type", "text")
        timestamp = msg.get("timestamp")

        if not from_number:
            logger.warning("webhook_missing_from", wa_message_id=wa_message_id)
            return

        # Extrai nome do contato do campo contacts (opcional)
        contacts_info = value.get("contacts", [])
        contact_name = from_number
        if contacts_info:
            profile = contacts_info[0].get("profile", {})
            contact_name = profile.get("name", from_number)

        logger.info(
            "webhook_inbound",
            from_number=from_number,
            wa_message_id=wa_message_id,
            msg_type=msg_type,
        )

        # 1. Get-or-create contato
        contact = self._contacts_uc.execute(name=contact_name, phone=from_number)

        # 2. Get-or-create conversa
        conversation = self._get_or_create_conversation(
            contact_id=UUID(contact["id"]),
            from_number=from_number,
        )
        conversation_id = UUID(conversation["id"])

        # 3. Extrair conteúdo da mensagem
        content, media_url = self._extract_content(msg, msg_type)

        # 4. Registrar mensagem inbound
        self._inbound_uc.execute(
            conversation_id,
            content=content or "",
            message_type=msg_type,
            wa_message_id=wa_message_id,
            media_url=media_url,
        )

        # 5. Fase 4: disparar automações para message_received
        try:
            from app.application.automations.use_cases import TriggerAutomationsUseCase
            TriggerAutomationsUseCase(self._account_id).execute(
                "message_received",
                {
                    "contact": contact,
                    "conversation": conversation,
                    "message": {
                        "type": msg_type,
                        "content": content,
                        "wa_message_id": wa_message_id,
                    },
                },
            )
        except Exception as e:
            logger.warning("automations_trigger_error", error=str(e))

        # 6. Fase 6: verificar se mensagem dispara ou avança um chatbot flow
        #    Flows têm prioridade sobre a resposta AI — se um flow estiver ativo
        #    ou for disparado pela keyword, o AI NÃO responde.
        flow_handled = False
        if content and msg_type == "text":
            try:
                from app.application.flows.use_cases import TriggerFlowUseCase
                flow_handled = TriggerFlowUseCase(self._account_id).execute(
                    message_text=content,
                    conversation_id=conversation_id,
                )
            except Exception as e:
                logger.warning("flow_trigger_error", error=str(e))

        # 7. Fase 5: se conversa tem ai_enabled e nenhum flow tratou a mensagem,
        #    acionar resposta automática via AI
        if not flow_handled and conversation.get("ai_enabled") and content and msg_type == "text":
            try:
                from app.application.ai.conversation_service import AIConversationService
                ai_svc = AIConversationService(self._account_id)
                ai_svc.process_inbound_message(
                    conversation_id=str(conversation_id),
                    inbound_text=content,
                    contact_name=contact_name if contact_name != from_number else None,
                    inbox_id=str(self._inbox_id),
                )
            except Exception as e:
                logger.warning("ai_response_error", error=str(e))

    def _get_or_create_conversation(self, *, contact_id: UUID, from_number: str) -> dict:
        """
        Busca conversa aberta para este contato + inbox.
        Se não existir, cria uma nova.
        """
        # Busca conversa aberta existente para este contato nesta inbox
        items, _ = self._convs_repo.list(
            contact_id=contact_id,
            status="open",
            per_page=1,
        )
        if items:
            return items[0]

        # Cria nova conversa
        return self._convs_repo.create(
            contact_id=contact_id,
            inbox_id=self._inbox_id,
        )

    @staticmethod
    def _extract_content(msg: dict, msg_type: str) -> tuple[Optional[str], Optional[str]]:
        """Extrai (content, media_url) do payload de acordo com o tipo."""
        if msg_type == "text":
            return msg.get("text", {}).get("body"), None

        if msg_type == "image":
            img = msg.get("image", {})
            return img.get("caption"), img.get("url")

        if msg_type == "audio":
            return "[áudio]", msg.get("audio", {}).get("url")

        if msg_type == "video":
            vid = msg.get("video", {})
            return vid.get("caption", "[vídeo]"), vid.get("url")

        if msg_type == "document":
            doc = msg.get("document", {})
            filename = doc.get("filename", "documento")
            return f"[documento: {filename}]", doc.get("url")

        if msg_type == "location":
            loc = msg.get("location", {})
            lat = loc.get("latitude")
            lng = loc.get("longitude")
            return f"[localização: {lat},{lng}]", None

        if msg_type == "button":
            return msg.get("button", {}).get("text"), None

        if msg_type == "interactive":
            inter = msg.get("interactive", {})
            btn_reply = inter.get("button_reply", {})
            list_reply = inter.get("list_reply", {})
            text = btn_reply.get("title") or list_reply.get("title") or "[interativo]"
            return text, None

        # Tipo não mapeado
        return f"[{msg_type}]", None

    # ── Status update ─────────────────────────────────────────────────────────

    def _handle_status_update(self, status_event: dict) -> None:
        wa_message_id = status_event.get("id")
        new_status = status_event.get("status")  # sent|delivered|read|failed

        if not wa_message_id or not new_status:
            return

        # Mapeia status da Meta para nosso domínio
        status_map = {
            "sent": "sent",
            "delivered": "delivered",
            "read": "read",
            "failed": "failed",
        }
        internal_status = status_map.get(new_status, new_status)
        self._msgs_repo.update_status(wa_message_id, internal_status)

        logger.info(
            "message_status_updated",
            wa_message_id=wa_message_id,
            status=internal_status,
        )
