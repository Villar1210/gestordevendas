"""
Worker Celery: envio de broadcast em lotes com rate limiting.

Rate limit padrão Meta Cloud API: ~80 mensagens/segundo por número.
Por segurança usamos 1 mensagem/segundo (configurável).
O worker processa BATCH_SIZE destinatários por execução, depois re-enfileira
o próximo lote até não restar pendentes.
"""
from __future__ import annotations

import logging
import time
from uuid import UUID

from celery import shared_task

logger = logging.getLogger(__name__)

BATCH_SIZE = 50
RATE_DELAY_SECS = 1.0


@shared_task(
    name="app.workers.broadcast.send_broadcast_batch",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="broadcasts",
)
def send_broadcast_batch(self, *, broadcast_id: str, account_id: str, batch_offset: int = 0):
    """
    Envia um lote de mensagens de broadcast via Meta Cloud API.
    Verifica cancelamento a cada destinatário.
    Re-enfileira próximo lote automaticamente até concluir.
    """
    from app.core.supabase import get_supabase_admin
    from app.infra.supabase.broadcasts_repo import BroadcastsRepository
    from app.infra.supabase.inboxes_repo import InboxesRepository
    from app.infra.meta_api.client import MetaCloudApiClient
    from app.domain.exceptions import ExternalServiceError

    account_uuid = UUID(account_id)
    broadcast_uuid = UUID(broadcast_id)
    repo = BroadcastsRepository(account_uuid)

    # 1. Verifica se broadcast ainda está running
    try:
        broadcast = repo.get_by_id(broadcast_uuid)
    except Exception as e:
        logger.error(f"[Broadcast] Não encontrado: {broadcast_id} — {e}")
        return

    if broadcast["status"] != "running":
        logger.info(f"[Broadcast] {broadcast_id} status={broadcast['status']}, abortando.")
        return

    # 2. Prepara cliente Meta
    inbox_id = UUID(broadcast["inbox_id"])
    try:
        inbox_repo = InboxesRepository(account_uuid)
        inbox = inbox_repo.get_by_id(inbox_id)
        token = inbox_repo.get_decrypted_token(inbox_id)
        client = MetaCloudApiClient(
            phone_number_id=inbox["phone_number_id"],
            access_token=token,
        )
    except Exception as e:
        logger.error(f"[Broadcast] Falha ao preparar cliente Meta: {e}")
        repo.update_status(broadcast_uuid, "failed")
        return

    # 3. Busca lote de destinatários pendentes
    recipients = repo.get_pending_recipients(
        broadcast_uuid, offset=batch_offset, limit=BATCH_SIZE
    )
    if not recipients:
        _complete(repo, broadcast_uuid, broadcast_id)
        return

    # 4. Envio com rate limiting
    template_name = broadcast["template_name"]
    template_params = broadcast.get("template_params") or []
    language_code = broadcast.get("language_code", "pt_BR")
    sent = failed = 0

    for recipient in recipients:
        # Verifica cancelamento a cada destinatário
        if repo.get_by_id(broadcast_uuid)["status"] != "running":
            logger.info(f"[Broadcast] {broadcast_id} cancelado durante envio.")
            return

        recipient_id = str(recipient["id"])
        phone = recipient["phone"]
        try:
            if template_params:
                wa_id = client.send_template_with_params(
                    to=phone,
                    template_name=template_name,
                    params=template_params,
                    language_code=language_code,
                )
            else:
                wa_id = client.send_template(
                    to=phone,
                    template_name=template_name,
                    language_code=language_code,
                )
            repo.update_recipient_status(recipient_id, new_status="sent", wa_message_id=wa_id)
            sent += 1
        except ExternalServiceError as e:
            repo.update_recipient_status(
                recipient_id, new_status="failed", error_code=str(e)[:100]
            )
            failed += 1
            logger.warning(f"[Broadcast] Falha {phone}: {e}")

        time.sleep(RATE_DELAY_SECS)

    repo.increment_counters(broadcast_uuid, sent=sent, failed=failed)
    logger.info(f"[Broadcast] Lote offset={batch_offset}: sent={sent} failed={failed}")

    # 5. Re-enfileira próximo lote ou finaliza
    if repo.count_pending(broadcast_uuid) > 0:
        send_broadcast_batch.delay(
            broadcast_id=broadcast_id,
            account_id=account_id,
            batch_offset=batch_offset + BATCH_SIZE,
        )
    else:
        _complete(repo, broadcast_uuid, broadcast_id)


def _complete(repo, broadcast_uuid, broadcast_id: str) -> None:
    import datetime
    repo.update_status(
        broadcast_uuid,
        "completed",
        extra={"completed_at": datetime.datetime.utcnow().isoformat()},
    )
    logger.info(f"[Broadcast] {broadcast_id} concluído.")
