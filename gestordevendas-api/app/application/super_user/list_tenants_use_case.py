"""
Use Case: Listar todos os tenants da plataforma.
Apenas Super Usuários podem acessar.
"""
from typing import List

from app.domain.entities import Account
from app.domain.exceptions import ForbiddenError
from app.infra.supabase.accounts_repo import AccountsRepository
from app.infra.supabase.acesso_plataforma_repo import AcessoPlataformaRepository


class ListTenantsUseCase:
    """Lista todos os tenants (Accounts) da plataforma com estatísticas."""

    def __init__(self, is_super_user: bool, super_usuario_id: str):
        self.is_super_user = is_super_user
        self.super_usuario_id = super_usuario_id

    def execute(self, limit: int = 1000) -> List[Account]:
        """
        Lista todos os tenants.

        Args:
            limit: Máximo de tenants a retornar

        Raises:
            ForbiddenError: Se o usuário não for Super Usuário
        """
        if not self.is_super_user:
            raise ForbiddenError("Apenas Super Usuários podem listar tenants")

        # Registrar acesso para auditoria
        AcessoPlataformaRepository.create(
            super_usuario_id=self.super_usuario_id,
            account_id=None,
            account_nome="Plataforma",
            acao="listar_tenants",
            detalhes=None,
        )

        # Retornar lista de tenants
        return AccountsRepository.find_all(limit=limit)
