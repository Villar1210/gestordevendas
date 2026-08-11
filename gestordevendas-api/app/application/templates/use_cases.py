"""
Use cases para Message Templates.
Lógica de negócio desacoplada de HTTP/infra.
"""
from __future__ import annotations

from uuid import UUID
from typing import Optional

from app.infra.supabase.template_repository import SupabaseTemplateRepository
from app.api.internal.schemas import (
    MessageTemplateCreate,
    MessageTemplateUpdate,
)


class CreateTemplateUseCase:
    """Criar novo template de mensagem."""

    def __init__(self, repo: SupabaseTemplateRepository):
        self.repo = repo

    def execute(
        self,
        account_id: UUID,
        data: MessageTemplateCreate,
        user_id: Optional[UUID],
    ) -> dict:
        """Executar criação de template."""
        return self.repo.create(
            account_id=account_id,
            name=data.name,
            content=data.content,
            category=data.category,
            media_url=data.media_url,
            created_by=user_id,
        )


class ListTemplatesUseCase:
    """Listar templates do account."""

    def __init__(self, repo: SupabaseTemplateRepository):
        self.repo = repo

    def execute(
        self,
        account_id: UUID,
        category: Optional[str] = None,
        include_inactive: bool = False,
    ) -> list[dict]:
        """Executar listagem de templates."""
        return self.repo.list_by_account(
            account_id=account_id,
            category=category,
            is_active=not include_inactive,
        )


class GetTemplateUseCase:
    """Buscar template específico."""

    def __init__(self, repo: SupabaseTemplateRepository):
        self.repo = repo

    def execute(self, account_id: UUID, template_id: UUID) -> dict:
        """Executar busca de template."""
        template = self.repo.find_by_id_and_account(template_id, account_id)
        if not template:
            raise ValueError("Template não encontrado")
        return template


class UpdateTemplateUseCase:
    """Atualizar template."""

    def __init__(self, repo: SupabaseTemplateRepository):
        self.repo = repo

    def execute(
        self,
        account_id: UUID,
        template_id: UUID,
        data: MessageTemplateUpdate,
    ) -> dict:
        """Executar atualização de template."""
        # Converter para dict e remover campos não preenchidos
        update_data = data.model_dump(exclude_unset=True)

        return self.repo.update(template_id, account_id, update_data)


class DeleteTemplateUseCase:
    """Deletar template."""

    def __init__(self, repo: SupabaseTemplateRepository):
        self.repo = repo

    def execute(self, account_id: UUID, template_id: UUID) -> bool:
        """Executar deleção de template."""
        success = self.repo.delete(template_id, account_id)
        if not success:
            raise ValueError("Template não encontrado ou não autorizado")
        return success


class ApplyTemplateUseCase:
    """Aplicar template (incrementar usage count)."""

    def __init__(self, repo: SupabaseTemplateRepository):
        self.repo = repo

    def execute(
        self,
        account_id: UUID,
        template_id: UUID,
        variables: Optional[dict[str, str]] = None,
    ) -> dict:
        """
        Executar aplicação de template.
        Retorna template com usage_count incrementado.
        """
        # Validar que template existe
        template = self.repo.find_by_id_and_account(template_id, account_id)
        if not template:
            raise ValueError("Template não encontrado")

        # Incrementar usage
        updated = self.repo.increment_usage(template_id, account_id)

        # Aplicar variáveis se fornecidas
        if variables:
            content = updated.get("content", "")
            for key, value in variables.items():
                content = content.replace(f"{{{{{key}}}}}", value)
            updated["content"] = content

        return updated
