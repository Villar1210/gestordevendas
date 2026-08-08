"""
Use cases de Inboxes WhatsApp.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from app.infra.meta_api.client import MetaCloudApiClient
from app.infra.supabase.inboxes_repo import InboxesRepository


class CreateInboxUseCase:
    def __init__(self, account_id: UUID):
        self._repo = InboxesRepository(account_id)

    def execute(
        self,
        *,
        name: str,
        phone_number_id: str,
        access_token: str,
        verify_credentials: bool = True,
        webhook_verify_token: Optional[str] = None,
    ) -> dict:
        display_phone_number = None
        verified_name = None

        if verify_credentials:
            # Valida as credenciais com a Meta antes de salvar
            client = MetaCloudApiClient(
                phone_number_id=phone_number_id,
                access_token=access_token,
            )
            info = client.get_phone_number_info()
            display_phone_number = info.get("display_phone_number")
            verified_name = info.get("verified_name")

        return self._repo.create(
            name=name,
            phone_number_id=phone_number_id,
            access_token=access_token,
            display_phone_number=display_phone_number,
            verified_name=verified_name,
            webhook_verify_token=webhook_verify_token,
        )


class ListInboxesUseCase:
    def __init__(self, account_id: UUID):
        self._repo = InboxesRepository(account_id)

    def execute(self) -> list[dict]:
        return self._repo.list()


class GetInboxUseCase:
    def __init__(self, account_id: UUID):
        self._repo = InboxesRepository(account_id)

    def execute(self, inbox_id: UUID) -> dict:
        return self._repo.get_by_id(inbox_id)


class UpdateInboxUseCase:
    def __init__(self, account_id: UUID):
        self._repo = InboxesRepository(account_id)

    def execute(self, inbox_id: UUID, data: dict) -> dict:
        return self._repo.update(inbox_id, data)


class DeleteInboxUseCase:
    def __init__(self, account_id: UUID):
        self._repo = InboxesRepository(account_id)

    def execute(self, inbox_id: UUID) -> None:
        self._repo.delete(inbox_id)


class GetMetaClientForInboxUseCase:
    """
    Cria e retorna um MetaCloudApiClient autenticado para a inbox.
    Usado pelos workers e pelo webhook. NUNCA retornar o client ao frontend.
    """
    def __init__(self, account_id: UUID):
        self._repo = InboxesRepository(account_id)

    def execute(self, inbox_id: UUID) -> MetaCloudApiClient:
        inbox = self._repo.get_by_id(inbox_id)
        token = self._repo.get_decrypted_token(inbox_id)
        return MetaCloudApiClient(
            phone_number_id=inbox["phone_number_id"],
            access_token=token,
        )
