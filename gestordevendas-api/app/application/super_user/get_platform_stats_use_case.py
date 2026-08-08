"""
Use Case: Obter estatísticas globais da plataforma.
Apenas Super Usuários podem acessar.
"""
from app.domain.entities import PlatformStats
from app.domain.exceptions import ForbiddenError
from app.infra.supabase.accounts_repo import AccountsRepository
from app.infra.supabase.profiles_repo import ProfilesRepository
from app.infra.supabase.contacts_repo import ContactsRepository
from app.infra.supabase.conversations_repo import ConversationsRepository
from app.infra.supabase.acesso_plataforma_repo import AcessoPlataformaRepository
from datetime import datetime


class GetPlatformStatsUseCase:
    """Calcula estatísticas globais da plataforma para o Super Usuário."""

    def __init__(self, is_super_user: bool, super_usuario_id: str):
        self.is_super_user = is_super_user
        self.super_usuario_id = super_usuario_id

    def execute(self) -> PlatformStats:
        """
        Retorna estatísticas globais: total de tenants, usuários, contatos, etc.

        Raises:
            ForbiddenError: Se o usuário não for Super Usuário
        """
        if not self.is_super_user:
            raise ForbiddenError("Apenas Super Usuários podem acessar estatísticas da plataforma")

        # Registrar acesso para auditoria
        AcessoPlataformaRepository.create(
            super_usuario_id=self.super_usuario_id,
            account_id=None,
            account_nome="Plataforma",
            acao="visualizar_stats",
            detalhes=None,
        )

        # Calcular estatísticas
        total_accounts = AccountsRepository.count_all()
        total_profiles = ProfilesRepository.count_all()
        total_contacts = ContactsRepository.count_all()
        total_conversations = ConversationsRepository.count_all()
        plans_breakdown = AccountsRepository.count_by_plan()

        return PlatformStats(
            total_accounts=total_accounts,
            total_profiles=total_profiles,
            total_contacts=total_contacts,
            total_conversations=total_conversations,
            active_accounts_today=total_accounts,  # TODO: implementar lógica de "active today"
            plans_breakdown=plans_breakdown,
            generated_at=datetime.utcnow(),
        )
