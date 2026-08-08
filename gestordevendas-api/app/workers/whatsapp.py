"""
Worker Celery: envio real de mensagens via Meta Cloud API.

Fluxo:
1. SendMessageUseCase salva mensagem com status='queued' e enfileira esta task.
2. Esta task lê a mensagem, busca a inbox, descriptografa o token e chama a Meta API.
3. Atualiza wa_message_id e status='sent' (ou 'failed') no banco.
4. O webhook de status (delivered/read) atualiza novamente via WebhookProcessor.
"""
from __future__ import annotations

import logging
from uuid import UUID

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name="app.workers.whatsapp.send_whatsapp_message",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    queue="default",
)
def send_whatsapp_message(self, message_id: str, conversation_id: str, account_id: str):
    """
    Envia uma mensagem (status='queued') via Meta Cloud API.
    Retenta até 3 vezes com delay de 10s em caso de falha transitória.
    """
    from app.core.supabase import get_supabase_admin
    from app.infra.meta_api.client import MetaCloudApiClient
    from app.infra.supabase.inboxes_repo import InboxesRepository
    from app.domain.exceptions import ExternalServiceError

    db = get_supabase_admin()

    # 1. Busca a mensagem (inclui media_url para envios de imagem/documento)
    msg_result = (
        db.table("messages")
        .select("id, content, message_type, template_name, template_params, media_url, conversation_id")
        .eq("id", message_id)
        .single()
        .execute()
    )
    if not msg_result.data:
        logger.error(f"[WhatsApp Worker] Mensagem não encontrada: {message_id}")
        return

    msg = msg_result.data

    # 2. Busca a conversa para pegar inbox_id e contato (número de destino)
    conv_result = (
        db.table("conversations")
        .select("inbox_id, contacts(phone)")
        .eq("id", conversation_id)
        .single()
        .execute()
    )
    if not conv_result.data:
        logger.error(f"[WhatsApp Worker] Conversa não encontrada: {conversation_id}")
        _mark_failed(db, message_id, "conversa_nao_encontrada")
        return

    conv = conv_result.data
    inbox_id = UUID(conv["inbox_id"])
    contact_phone = (conv.get("contacts") or {}).get("phone", "")

    if not contact_phone:
        logger.error(f"[WhatsApp Worker] Número de destino ausente para conversa {conversation_id}")
        _mark_failed(db, message_id, "numero_ausente")
        return

    # 3. Busca token da inbox e cria client
    try:
        repo = InboxesRepository(UUID(account_id))
        inbox = repo.get_by_id(inbox_id)
        token = repo.get_decrypted_token(inbox_id)
        client = MetaCloudApiClient(
            phone_number_id=inbox["phone_number_id"],
            access_token=token,
        )
    except Exception as e:
        logger.error(f"[WhatsApp Worker] Erro ao preparar client Meta: {e}")
        _mark_failed(db, message_id, str(e)[:200])
        return

    # 4. Envio de acordo com o tipo
    msg_type = msg.get("message_type", "text")
    content = msg.get("content", "")
    media_url = msg.get("media_url", "")
    template_name = msg.get("template_name")
    template_params = msg.get("template_params")

    try:
        if msg_type == "template" and template_name:
            if template_params:
                wa_id = client.send_template_with_params(
                    to=contact_phone,
                    template_name=template_name,
                    params=template_params,
                )
            else:
                wa_id = client.send_template(to=contact_phone, template_name=template_name)
        elif msg_type == "image" and media_url:
            # Usa media_url (não content) para envio de imagem
            wa_id = client.send_image(to=contact_phone, image_url=media_url)
        else:
            # Default: texto
            wa_id = client.send_text(to=contact_phone, text=content)

        # 5. Atualiza mensagem com wa_message_id e status=sent
        db.table("messages").update({
            "wa_message_id": wa_id,
            "status": "sent",
            "error_code": None,
        }).eq("id", message_id).execute()

        logger.info(f"[WhatsApp Worker] Enviado: message_id={message_id} wa_id={wa_id}")

    except ExternalServiceError as exc:
        logger.error(f"[WhatsApp Worker] Falha ao enviar: {exc}")
        # Retenta se não for a última tentativa
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _mark_failed(db, message_id, str(exc)[:200])


@shared_task(
    name="app.workers.whatsapp.mark_messages_read",
    queue="default",
)
def mark_messages_read(inbox_id: str, account_id: str, wa_message_ids: list[str]):
    """
    Marca mensagens como lidas na Meta (✓✓ azul) em lote.
    Chamado quando o agente abre a conversa.
    """
    from app.infra.supabase.inboxes_repo import InboxesRepository
    from app.infra.meta_api.client import MetaCloudApiClient

    try:
        repo = InboxesRepository(UUID(account_id))
        inbox = repo.get_by_id(UUID(inbox_id))
        token = repo.get_decrypted_token(UUID(inbox_id))
        client = MetaCloudApiClient(
            phone_number_id=inbox["phone_number_id"],
            access_token=token,
        )
        for wa_id in wa_message_ids:
            client.mark_as_read(wa_id)
    except Exception as e:
        logger.error(f"[WhatsApp Worker] Falha ao marcar como lida: {e}")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mark_failed(db, message_id: str, error_code: str) -> None:
    db.table("messages").update({
        "status": "failed",
        "error_code": error_code[:100],
    }).eq("id", message_id).execute()
