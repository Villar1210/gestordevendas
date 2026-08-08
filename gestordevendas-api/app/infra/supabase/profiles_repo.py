"""
Repositório de Profiles (Usuários).
Expandido para suportar o módulo Super Usuário (is_super_user).
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from app.core.supabase import get_supabase_client
from app.domain.entities import Profile
from app.domain.enums import Role


class ProfilesRepository:
    """Persistência de Profiles em Supabase."""

    TABLE_NAME = "profiles"

    @staticmethod
    def find_all_super_users() -> List[Profile]:
        """
        Lista todos os Super Usuários (is_super_user=true).
        Usado para auditoria de permissões.
        """
        client = get_supabase_client()

        response = client.table(ProfilesRepository.TABLE_NAME).select(
            "*"
        ).eq(
            "is_super_user", True
        ).execute()

        return [
            Profile(
                id=row["id"],
                account_id=row["account_id"],
                email=row["email"],
                name=row["name"],
                role=Role(row.get("role", Role.VIEWER.value)),
                created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
                is_super_user=row.get("is_super_user", False),
            )
            for row in response.data
        ]

    @staticmethod
    def find_by_id(profile_id: str) -> Optional[Profile]:
        """Busca um Profile por ID."""
        client = get_supabase_client()

        response = client.table(ProfilesRepository.TABLE_NAME).select(
            "*"
        ).eq(
            "id", profile_id
        ).limit(1).execute()

        if not response.data:
            return None

        row = response.data[0]
        return Profile(
            id=row["id"],
            account_id=row["account_id"],
            email=row["email"],
            name=row["name"],
            role=Role(row.get("role", Role.VIEWER.value)),
            created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
            is_super_user=row.get("is_super_user", False),
        )

    @staticmethod
    def find_by_email(email: str) -> Optional[Profile]:
        """Busca um Profile por email."""
        client = get_supabase_client()

        response = client.table(ProfilesRepository.TABLE_NAME).select(
            "*"
        ).eq(
            "email", email
        ).limit(1).execute()

        if not response.data:
            return None

        row = response.data[0]
        return Profile(
            id=row["id"],
            account_id=row["account_id"],
            email=row["email"],
            name=row["name"],
            role=Role(row.get("role", Role.VIEWER.value)),
            created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
            is_super_user=row.get("is_super_user", False),
        )

    @staticmethod
    def set_super_user(profile_id: str, is_super_user: bool) -> Profile:
        """
        Marca/desmarca um Profile como Super Usuário.
        Operação sensível de segurança — deve ser auditada.
        """
        client = get_supabase_client()

        response = client.table(ProfilesRepository.TABLE_NAME).update(
            {"is_super_user": is_super_user}
        ).eq(
            "id", profile_id
        ).execute()

        if not response.data:
            raise RuntimeError(f"Falha ao atualizar Super Usuário: {profile_id}")

        row = response.data[0]
        return Profile(
            id=row["id"],
            account_id=row["account_id"],
            email=row["email"],
            name=row["name"],
            role=Role(row.get("role", Role.VIEWER.value)),
            created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
            is_super_user=row.get("is_super_user", False),
        )

    @staticmethod
    def count_all() -> int:
        """Conta total de Profiles na plataforma."""
        client = get_supabase_client()
        response = client.table(ProfilesRepository.TABLE_NAME).select(
            "id", count="exact"
        ).execute()
        return response.count or 0

    @staticmethod
    def count_by_account(account_id: str) -> int:
        """Conta Profiles em um account específico."""
        client = get_supabase_client()
        response = client.table(ProfilesRepository.TABLE_NAME).select(
            "id", count="exact"
        ).eq(
            "account_id", account_id
        ).execute()
        return response.count or 0
