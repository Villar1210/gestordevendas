"""
Use cases de Contacts — orquestram o repositório sem conhecer HTTP.
Dependência: domain/ e infra/supabase/ — nunca FastAPI diretamente.
"""
from __future__ import annotations

import math
from typing import Optional
from uuid import UUID

from app.infra.supabase.contacts_repo import ContactsRepository


class CreateContactUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ContactsRepository(account_id)

    def execute(
        self,
        *,
        name: str,
        phone: str,
        email: Optional[str] = None,
        avatar_url: Optional[str] = None,
        custom_attributes: Optional[dict] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        return self._repo.create(
            name=name,
            phone=phone,
            email=email,
            avatar_url=avatar_url,
            custom_attributes=custom_attributes,
            tags=tags,
        )


class GetContactUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ContactsRepository(account_id)

    def execute(self, contact_id: UUID) -> dict:
        return self._repo.get_by_id(contact_id)


class ListContactsUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ContactsRepository(account_id)

    def execute(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        search: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> dict:
        items, total = self._repo.list(
            page=page,
            per_page=per_page,
            search=search,
            tag=tag,
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (page * per_page) < total,
        }


class UpdateContactUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ContactsRepository(account_id)

    def execute(self, contact_id: UUID, data: dict) -> dict:
        return self._repo.update(contact_id, data)


class DeleteContactUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ContactsRepository(account_id)

    def execute(self, contact_id: UUID) -> None:
        self._repo.delete(contact_id)


class GetOrCreateContactUseCase:
    """
    Usado pelo webhook de WhatsApp: garante que o contato existe,
    criando-o se não existir. Retorna sempre o contato (novo ou existente).
    """
    def __init__(self, account_id: UUID):
        self._repo = ContactsRepository(account_id)

    def execute(self, *, name: str, phone: str) -> dict:
        existing = self._repo.get_by_phone(phone)
        if existing:
            return existing
        return self._repo.create(name=name, phone=phone)
