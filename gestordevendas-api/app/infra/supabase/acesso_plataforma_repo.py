"""
Repositório de auditoria: Módulo Super Usuário — acesso cross-tenant.
Registra quem (Super Usuário) acessou qual tenant e quando.
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from app.core.supabase import get_supabase_client
from app.domain.entities import AcessoPlataformaLog


class AcessoPlataformaRepository:
    """Persistência de logs de acesso cross-tenant em Supabase."""

    TABLE_NAME = "acesso_plataforma_logs"

    @staticmethod
    def create(
        super_usuario_id: str,
        account_id: Optional[str],
        account_nome: str,
        acao: str,
        detalhes: Optional[str] = None,
    ) -> AcessoPlataformaLog:
        """
        Registra um acesso de Super Usuário a um tenant.

        Args:
            super_usuario_id: ID do Profile do Super Usuário
            account_id: ID do Account (tenant) acessado (nullable se deletado)
            account_nome: Snapshot do nome do Account no momento do acesso
            acao: Tipo de ação realizada
            detalhes: Detalhes adicionais (JSON ou texto)
        """
        client = get_supabase_client()
        id = str(uuid4())
        now = datetime.utcnow().isoformat()

        response = client.table(AcessoPlataformaRepository.TABLE_NAME).insert({
            "id": id,
            "super_usuario_id": super_usuario_id,
            "account_id": account_id,
            "account_nome": account_nome,
            "acao": acao,
            "detalhes": detalhes,
            "created_at": now,
        }).execute()

        if not response.data:
            raise RuntimeError(f"Falha ao registrar acesso de Super Usuário")

        data = response.data[0]
        return AcessoPlataformaLog(
            id=data["id"],
            super_usuario_id=data["super_usuario_id"],
            account_id=data["account_id"],
            account_nome=data["account_nome"],
            acao=data["acao"],
            detalhes=data.get("detalhes"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
        )

    @staticmethod
    def find_by_super_usuario(super_usuario_id: str, limit: int = 100) -> List[AcessoPlataformaLog]:
        """
        Lista acessos realizados por um Super Usuário específico.
        Ordenado por data decrescente (mais recentes primeiro).
        """
        client = get_supabase_client()

        response = client.table(AcessoPlataformaRepository.TABLE_NAME).select(
            "*"
        ).eq(
            "super_usuario_id", super_usuario_id
        ).order(
            "created_at", desc=True
        ).limit(limit).execute()

        return [
            AcessoPlataformaLog(
                id=row["id"],
                super_usuario_id=row["super_usuario_id"],
                account_id=row["account_id"],
                account_nome=row["account_nome"],
                acao=row["acao"],
                detalhes=row.get("detalhes"),
                created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
            )
            for row in response.data
        ]

    @staticmethod
    def find_by_account(account_id: str, limit: int = 100) -> List[AcessoPlataformaLog]:
        """
        Lista todos os acessos realizados a um tenant específico
        por qualquer Super Usuário (auditoria de segurança).
        """
        client = get_supabase_client()

        response = client.table(AcessoPlataformaRepository.TABLE_NAME).select(
            "*"
        ).eq(
            "account_id", account_id
        ).order(
            "created_at", desc=True
        ).limit(limit).execute()

        return [
            AcessoPlataformaLog(
                id=row["id"],
                super_usuario_id=row["super_usuario_id"],
                account_id=row["account_id"],
                account_nome=row["account_nome"],
                acao=row["acao"],
                detalhes=row.get("detalhes"),
                created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
            )
            for row in response.data
        ]
