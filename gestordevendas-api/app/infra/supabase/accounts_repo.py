"""
Repositório de Accounts (Tenants).
Usado pelo módulo Super Usuário para listar todos os tenants da plataforma.
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from app.core.supabase import get_supabase_client
from app.domain.entities import Account
from app.domain.enums import Plan


class AccountsRepository:
    """Persistência de Accounts em Supabase."""

    TABLE_NAME = "accounts"

    @staticmethod
    def find_all(limit: int = 1000) -> List[Account]:
        """
        Lista todos os accounts (tenants) da plataforma.
        Usado por Super Usuários para ver visão global.
        """
        client = get_supabase_client()

        response = client.table(AccountsRepository.TABLE_NAME).select(
            "*"
        ).order(
            "created_at", desc=True
        ).limit(limit).execute()

        return [
            Account(
                id=row["id"],
                name=row["name"],
                owner_id=row["owner_id"],
                plan=Plan(row.get("plan", Plan.FREE.value)),
                white_label_config=row.get("white_label_config", {}),
                created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
            )
            for row in response.data
        ]

    @staticmethod
    def find_by_id(account_id: str) -> Optional[Account]:
        """
        Busca um account específico por ID.
        Usado para auditoria de acesso a um tenant específico.
        """
        client = get_supabase_client()

        response = client.table(AccountsRepository.TABLE_NAME).select(
            "*"
        ).eq(
            "id", account_id
        ).limit(1).execute()

        if not response.data:
            return None

        row = response.data[0]
        return Account(
            id=row["id"],
            name=row["name"],
            owner_id=row["owner_id"],
            plan=Plan(row.get("plan", Plan.FREE.value)),
            white_label_config=row.get("white_label_config", {}),
            created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
        )

    @staticmethod
    def count_all() -> int:
        """Conta total de accounts na plataforma."""
        client = get_supabase_client()
        response = client.table(AccountsRepository.TABLE_NAME).select(
            "id", count="exact"
        ).execute()
        return response.count or 0

    @staticmethod
    def count_by_plan() -> dict:
        """
        Retorna contagem de accounts por plano.
        Usado para estatísticas de plataforma.
        Exemplo: {"free": 10, "pro": 5, "enterprise": 2}
        """
        client = get_supabase_client()

        response = client.table(AccountsRepository.TABLE_NAME).select(
            "plan"
        ).execute()

        breakdown = {}
        for row in response.data:
            plan = row.get("plan", Plan.FREE.value)
            breakdown[plan] = breakdown.get(plan, 0) + 1

        return breakdown
