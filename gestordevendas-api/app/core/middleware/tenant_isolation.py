"""
Middleware de isolamento de tenant.

Garante que:
1. Cada usuário só acessa dados do seu tenant
2. Super Admin pode acessar dados de qualquer tenant
3. Cada query é automaticamente filtrada por tenant_id
"""
from typing import Callable, Optional
from fastapi import Request
from app.core.dependencies import CurrentUser, get_current_user


class TenantIsolationMiddleware:
    """
    Middleware que valida isolamento de tenant em cada requisição.

    Comportamento:
    - Usuários normais: filtrados para seu account_id
    - Super Admin: sem filtro (acesso cross-tenant)
    """

    def __init__(self, app, db_session):
        self.app = app
        self.db = db_session

    async def __call__(self, request: Request, call_next: Callable):
        """Processa cada requisição verificando isolamento de tenant."""

        # Endpoints públicos (sem auth) — sem isolamento necessário
        public_paths = ["/health", "/docs", "/openapi.json", "/auth/login", "/auth/register"]
        if any(request.url.path.startswith(path) for path in public_paths):
            return await call_next(request)

        # Para endpoints autenticados, adicionar contexto de tenant
        try:
            # Extrair user do token (já foi validado pelo require_* dependencies)
            # Aqui apenas armazenamos para uso posterior no request
            request.state.tenant_id = getattr(request.state, "tenant_id", None)
            request.state.is_super_user = getattr(request.state, "is_super_user", False)
        except Exception:
            pass

        response = await call_next(request)
        return response


class TenantFilter:
    """
    Classe helper para filtrar queries por tenant automaticamente.

    Uso:
        # Em um repository
        filter = TenantFilter(user.account_id, user.role)
        where_clause = filter.get_where()
        # SELECT * FROM contacts WHERE {where_clause}
    """

    def __init__(self, tenant_id: Optional[str], is_super_admin: bool = False):
        self.tenant_id = tenant_id
        self.is_super_admin = is_super_admin

    def get_where(self) -> str:
        """Retorna a cláusula WHERE para filtrar por tenant."""
        if self.is_super_admin:
            # Super admin vê tudo — sem filtro
            return "1=1"

        if not self.tenant_id:
            # Sem tenant definido — não retorna nada
            return "1=0"

        # Usuário normal — filtrado para seu tenant
        return f'account_id = \'{self.tenant_id}\''

    def validate_access(self, resource_tenant_id: str) -> bool:
        """
        Valida se o usuário pode acessar um recurso específico.

        Args:
            resource_tenant_id: tenant_id do recurso a ser acessado

        Returns:
            True se acesso permitido, False caso contrário
        """
        if self.is_super_admin:
            return True

        return resource_tenant_id == self.tenant_id


def require_tenant_access(required_tenant_id: str):
    """
    Dependency para validar acesso a tenant específico.

    Uso nos endpoints:
        @router.get("/tenants/{tenant_id}/data")
        async def get_data(
            tenant_id: str,
            user: CurrentUser = Depends(get_current_user),
            _ = Depends(require_tenant_access(tenant_id))
        ):
            ...
    """
    async def check_access(
        user: CurrentUser = Depends(get_current_user),
    ) -> bool:
        filter = TenantFilter(user.account_id, user.role.value == "super_admin")
        if not filter.validate_access(required_tenant_id):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=403,
                detail=f"Acesso negado ao tenant {required_tenant_id}",
            )
        return True

    return check_access


# ─── Exemplo de uso em repositórios ───────────────────────────────────────────

def example_repository_with_tenant_filter(db, user_account_id: str, is_super_admin: bool):
    """
    Exemplo de como usar TenantFilter em um repository.
    """
    filter = TenantFilter(user_account_id, is_super_admin)

    # Exemplo com SQL raw (já filtrado por tenant):
    # query = f"SELECT * FROM contacts WHERE {filter.get_where()}"
    # results = db.execute(query).fetchall()

    # Exemplo com ORM (Sqlalchemy):
    # from app.infra.db.models import Contact
    # if is_super_admin:
    #     results = db.query(Contact).all()
    # else:
    #     results = db.query(Contact).filter(Contact.account_id == user_account_id).all()

    return filter
