"""
Use cases de Conversations.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from app.infra.supabase.conversations_repo import ConversationsRepository


class CreateConversationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ConversationsRepository(account_id)

    def execute(
        self,
        *,
        contact_id: UUID,
        inbox_id: UUID,
        assignee_id: Optional[UUID] = None,
    ) -> dict:
        return self._repo.create(
            contact_id=contact_id,
            inbox_id=inbox_id,
            assignee_id=assignee_id,
        )


class GetConversationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ConversationsRepository(account_id)

    def execute(self, conversation_id: UUID) -> dict:
        return self._repo.get_by_id(conversation_id)


class ListConversationsUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ConversationsRepository(account_id)

    def execute(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        status: Optional[str] = None,
        assignee_id: Optional[UUID] = None,
        contact_id: Optional[UUID] = None,
        search: Optional[str] = None,
    ) -> dict:
        items, total = self._repo.list(
            page=page,
            per_page=per_page,
            status=status,
            assignee_id=assignee_id,
            contact_id=contact_id,
            search=search,
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (page * per_page) < total,
        }


class AssignConversationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ConversationsRepository(account_id)

    def execute(self, conversation_id: UUID, assignee_id: Optional[UUID]) -> dict:
        return self._repo.assign(conversation_id, assignee_id)


class CloseConversationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ConversationsRepository(account_id)

    def execute(self, conversation_id: UUID) -> dict:
        return self._repo.close(conversation_id)


class ReopenConversationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ConversationsRepository(account_id)

    def execute(self, conversation_id: UUID) -> dict:
        return self._repo.reopen(conversation_id)


class ToggleAIUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ConversationsRepository(account_id)

    def execute(self, conversation_id: UUID, enabled: bool) -> dict:
        return self._repo.toggle_ai(conversation_id, enabled)
