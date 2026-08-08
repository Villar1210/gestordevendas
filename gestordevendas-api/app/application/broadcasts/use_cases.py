"""
Use cases de Broadcasts.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.domain.exceptions import ConflictError
from app.infra.supabase.broadcasts_repo import BroadcastsRepository

logger = structlog.get_logger(__name__)


class CreateBroadcastUseCase:
    def __init__(self, account_id: UUID):
        self._repo = BroadcastsRepository(account_id)

    def execute(
        self,
        *,
        inbox_id: UUID,
        name: str,
        template_name: str,
        template_params: Optional[list] = None,
        language_code: str = "pt_BR",
        scheduled_at: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> dict:
        return self._repo.create(
            inbox_id=inbox_id,
            name=name,
            template_name=template_name,
            template_params=template_params,
            language_code=language_code,
            scheduled_at=scheduled_at,
            created_by=created_by,
        )


class GetBroadcastUseCase:
    def __init__(self, account_id: UUID):
        self._repo = BroadcastsRepository(account_id)

    def execute(self, broadcast_id: UUID) -> dict:
        return self._repo.get_by_id(broadcast_id)


class ListBroadcastsUseCase:
    def __init__(self, account_id: UUID):
        self._repo = BroadcastsRepository(account_id)

    def execute(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        status: Optional[str] = None,
    ) -> dict:
        items, total = self._repo.list(page=page, per_page=per_page, status=status)
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (page * per_page) < total,
        }


class AddRecipientsToBroadcastUseCase:
    """
    Adiciona destinatários a um broadcast em status 'draft'.
    Aceita lista de contact_ids ou números de telefone avulsos.
    """

    def __init__(self, account_id: UUID):
        self._account_id = account_id
        self._repo = BroadcastsRepository(account_id)

    def execute(
        self,
        broadcast_id: UUID,
        *,
        contact_ids: Optional[list[str]] = None,
        phones: Optional[list[str]] = None,
    ) -> dict:
        from app.infra.supabase.contacts_repo import ContactsRepository

        recipients = []

        # Adiciona contatos por ID (busca o telefone no banco)
        if contact_ids:
            contacts_repo = ContactsRepository(self._account_id)
            for cid in contact_ids:
                try:
                    c = contacts_repo.get_by_id(UUID(cid))
                    recipients.append({"contact_id": cid, "phone": c["phone"]})
                except Exception as e:
                    logger.warning("recipient_not_found", contact_id=cid, error=str(e))

        # Adiciona números avulsos (sem contact_id existente — cria contato mínimo)
        if phones:
            from app.application.contacts.use_cases import GetOrCreateContactUseCase
            uc = GetOrCreateContactUseCase(self._account_id)
            for phone in phones:
                try:
                    c = uc.execute(name=phone, phone=phone)
                    recipients.append({"contact_id": c["id"], "phone": phone})
                except Exception as e:
                    logger.warning("phone_recipient_error", phone=phone, error=str(e))

        if not recipients:
            return {"added": 0, "broadcast_id": str(broadcast_id)}

        added = self._repo.add_recipients(broadcast_id, recipients)
        return {"added": added, "broadcast_id": str(broadcast_id)}


class LaunchBroadcastUseCase:
    """
    Valida e lança o envio do broadcast:
    1. Broadcast deve estar em status 'draft' com pelo menos 1 destinatário.
    2. Muda status para 'running'.
    3. Enfileira o worker Celery (send_broadcast_batch).
    """

    def __init__(self, account_id: UUID):
        self._repo = BroadcastsRepository(account_id)

    def execute(self, broadcast_id: UUID) -> dict:
        broadcast = self._repo.get_by_id(broadcast_id)

        if broadcast["status"] not in ("draft", "scheduled"):
            raise ConflictError(
                f"Broadcast só pode ser lançado de 'draft' ou 'scheduled'. "
                f"Status atual: {broadcast['status']}"
            )
        if (broadcast.get("total_recipients") or 0) == 0:
            raise ConflictError("Adicione ao menos um destinatário antes de lançar.")

        import datetime
        broadcast = self._repo.update_status(
            broadcast_id,
            "running",
            extra={"started_at": datetime.datetime.utcnow().isoformat()},
        )

        # Enfileira worker
        try:
            from app.workers.broadcast import send_broadcast_batch
            send_broadcast_batch.delay(
                broadcast_id=str(broadcast_id),
                account_id=str(self._repo._account_id),
                batch_offset=0,
            )
        except Exception as e:
            logger.error("broadcast_queue_error", error=str(e))
            # Reverte para draft se não conseguir enfileirar
            self._repo.update_status(broadcast_id, "draft")
            raise

        logger.info("broadcast_launched", broadcast_id=str(broadcast_id))
        return broadcast


class CancelBroadcastUseCase:
    def __init__(self, account_id: UUID):
        self._repo = BroadcastsRepository(account_id)

    def execute(self, broadcast_id: UUID) -> dict:
        broadcast = self._repo.get_by_id(broadcast_id)
        if broadcast["status"] in ("completed", "cancelled"):
            raise ConflictError(f"Broadcast já está {broadcast['status']}.")
        return self._repo.update_status(broadcast_id, "cancelled")
