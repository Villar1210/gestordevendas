"""
Use Case: Registrar assunção de controle de um tenant.
Usado para auditoria e suporte ao tenant específico.

Nota: O Deskcomm usa Supabase Auth para gerar JWTs. Este use case registra
a intenção de assumir um tenant na trilha de auditoria. Para acessar o tenant,
o Super Usuário deve fazer login em uma sessão separada e especificar o
tenant desejado.
"""
from datetime import datetime, timedelta
import json

from app.domain.exceptions import ForbiddenError, NotFoundError
from app.infra.supabase.accounts_repo import AccountsRepository
from app.infra.supabase.acesso_plataforma_repo import AcessoPlataformaRepository


class AssumeAdminForTenantUseCase:
    """Registra a assunção de admin de um tenant por um Super Usuário."""

    def __init__(self, is_super_user: bool, super_usuario_id: str):
        self.is_super_user = is_super_user
        self.super_usuario_id = super_usuario_id

    def execute(
        self,
        account_id: str,
        expires_in_minutes: int = 60,
    ) -> dict:
        """
        Registra na auditoria que um Super Usuário está assumindo controle de um tenant.

        Args:
            account_id: ID do tenant a assumir
            expires_in_minutes: Duração sugerida da sessão de suporte (para registro)

        Returns:
            Dict com informações do tenant e instruções de acesso

        Raises:
            ForbiddenError: Se não for Super Usuário
            NotFoundError: Se o tenant não existir
        """
        if not self.is_super_user:
            raise ForbiddenError("Apenas Super Usuários podem assumir admin de tenants")

        # Verificar que o tenant existe
        account = AccountsRepository.find_by_id(account_id)
        if not account:
            raise NotFoundError(f"Tenant {account_id} não encontrado")

        # Registrar acesso para auditoria
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
        AcessoPlataformaRepository.create(
            super_usuario_id=self.super_usuario_id,
            account_id=account_id,
            account_nome=account.name,
            acao="asumir_admin",
            detalhes=json.dumps({"expires_in_minutes": expires_in_minutes}),
        )

        return {
            "status": "registered",
            "account_id": account_id,
            "account_name": account.name,
            "account_owner_id": account.owner_id,
            "account_plan": account.plan.value,
            "assumption_expires_at": expires_at.isoformat(),
            "expires_in_minutes": expires_in_minutes,
            "note": "Este registro foi adicionado à trilha de auditoria. Para acessar o tenant, faça login em uma sessão separada.",
            "instructions": {
                "step_1": "Abra uma nova sessão/aba incógnita",
                "step_2": "Acesse https://gestordevendas.ivillar.com.br/login",
                "step_3": "Faça login com uma conta do tenant (ou criada no tenant)",
                "step_4": "Você terá acesso como admin ao tenant especificado",
                "duration": f"Seu acesso é registrado e expirará em {expires_in_minutes} minutos",
            },
        }
