"""
Repository para Message Templates usando Supabase.
Implementa a interface ITemplateRepository.
"""
from __future__ import annotations

from uuid import UUID
from typing import Optional

from app.infra.supabase.client import SupabaseClient


class SupabaseTemplateRepository:
    """Repository de Message Templates no Supabase."""

    def __init__(self, supabase: SupabaseClient):
        self.db = supabase.client

    def create(
        self,
        account_id: UUID,
        name: str,
        content: str,
        category: str,
        media_url: Optional[str],
        created_by: Optional[UUID],
    ) -> dict:
        """Criar novo template de mensagem."""
        result = self.db.table("message_templates").insert(
            {
                "account_id": str(account_id),
                "name": name,
                "content": content,
                "category": category,
                "media_url": media_url,
                "created_by": str(created_by) if created_by else None,
            }
        ).execute()

        if result.data:
            return result.data[0]
        raise ValueError("Falha ao criar template")

    def list_by_account(
        self,
        account_id: UUID,
        category: Optional[str] = None,
        is_active: bool = True,
    ) -> list[dict]:
        """Listar templates do account."""
        query = (
            self.db.table("message_templates")
            .select("*")
            .eq("account_id", str(account_id))
            .eq("is_active", is_active)
            .order("name", desc=False)
        )

        if category:
            query = query.eq("category", category)

        result = query.execute()
        return result.data or []

    def find_by_id_and_account(
        self, template_id: UUID, account_id: UUID
    ) -> Optional[dict]:
        """Buscar template específico."""
        result = (
            self.db.table("message_templates")
            .select("*")
            .eq("id", str(template_id))
            .eq("account_id", str(account_id))
            .single()
            .execute()
        )

        return result.data if result.data else None

    def update(
        self, template_id: UUID, account_id: UUID, data: dict
    ) -> dict:
        """Atualizar template."""
        # Remover account_id e id se vierem no dict (não podem ser atualizados)
        data.pop("id", None)
        data.pop("account_id", None)

        result = (
            self.db.table("message_templates")
            .update(data)
            .eq("id", str(template_id))
            .eq("account_id", str(account_id))
            .execute()
        )

        if result.data:
            return result.data[0]
        raise ValueError("Template não encontrado ou não autorizado")

    def delete(self, template_id: UUID, account_id: UUID) -> bool:
        """Deletar template."""
        result = (
            self.db.table("message_templates")
            .delete()
            .eq("id", str(template_id))
            .eq("account_id", str(account_id))
            .execute()
        )

        return len(result.data) > 0 if result.data else False

    def increment_usage(self, template_id: UUID, account_id: UUID) -> dict:
        """Incrementar contador de uso quando template é aplicado."""
        # Fetch current count
        current = self.find_by_id_and_account(template_id, account_id)
        if not current:
            raise ValueError("Template não encontrado")

        new_count = current.get("usage_count", 0) + 1
        return self.update(template_id, account_id, {"usage_count": new_count})
