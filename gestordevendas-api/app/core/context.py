"""
Contexto de requisição com informações de tenant e usuário.

Garante que cada requisição tem acesso ao contexto completo:
- tenant_id (account_id)
- user_id
- role
- email
- is_super_admin
- request_id (para rastreamento)
"""
from contextvars import ContextVar
from typing import Optional
from dataclasses import dataclass
from datetime import datetime
from uuid import uuid4


@dataclass
class RequestContext:
    """Contexto de uma requisição HTTP."""

    # Identificadores
    request_id: str  # UUID para rastreamento
    user_id: str
    email: str
    tenant_id: Optional[str]  # account_id

    # Permissões
    role: str  # "viewer", "agent", "owner", "admin", "super_admin"
    is_super_admin: bool

    # Metadata
    timestamp: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    def __post_init__(self):
        """Validações após inicialização."""
        if not self.request_id:
            self.request_id = str(uuid4())
        if not self.timestamp:
            self.timestamp = datetime.utcnow()


# Variável de contexto thread-safe
_context: ContextVar[Optional[RequestContext]] = ContextVar(
    "request_context", default=None
)


def get_context() -> Optional[RequestContext]:
    """Obter contexto da requisição atual."""
    return _context.get()


def set_context(context: RequestContext) -> None:
    """Definir contexto da requisição."""
    _context.set(context)


def clear_context() -> None:
    """Limpar contexto da requisição."""
    _context.set(None)


def get_tenant_id() -> Optional[str]:
    """Obter tenant_id da requisição atual."""
    ctx = get_context()
    return ctx.tenant_id if ctx else None


def get_user_id() -> Optional[str]:
    """Obter user_id da requisição atual."""
    ctx = get_context()
    return ctx.user_id if ctx else None


def get_request_id() -> Optional[str]:
    """Obter request_id (para rastreamento)."""
    ctx = get_context()
    return ctx.request_id if ctx else None


def get_is_super_admin() -> bool:
    """Verificar se é Super Admin na requisição atual."""
    ctx = get_context()
    return ctx.is_super_admin if ctx else False


def get_role() -> Optional[str]:
    """Obter role do usuário na requisição atual."""
    ctx = get_context()
    return ctx.role if ctx else None


def assert_tenant_access(required_tenant_id: str) -> bool:
    """
    Validar acesso ao tenant específico na requisição atual.

    Raises:
        PermissionError: Se não tem acesso
    """
    ctx = get_context()
    if not ctx:
        raise PermissionError("Sem contexto de requisição")

    if ctx.is_super_admin:
        return True

    if ctx.tenant_id != required_tenant_id:
        raise PermissionError(
            f"Acesso negado ao tenant {required_tenant_id}. "
            f"Seu tenant: {ctx.tenant_id}"
        )

    return True


# ─── Exemplo de uso em repositories ────────────────────────────────────────

def example_repository_usage():
    """
    Exemplo de como usar RequestContext em um repository.

    ```python
    from app.core.context import get_tenant_id, get_context

    class ContactRepository:
        def get_by_id(self, contact_id: str):
            tenant_id = get_tenant_id()
            if not tenant_id:
                raise ValueError("Tenant ID não definido")

            # Query automaticamente filtrada por tenant
            contact = db.query(Contact).filter(
                Contact.id == contact_id,
                Contact.account_id == tenant_id,  # Isolamento automático
            ).first()

            if not contact:
                raise NotFoundError(f"Contato {contact_id} não encontrado")

            return contact

        def list_all(self):
            tenant_id = get_tenant_id()
            # Todos os contatos do tenant atual
            return db.query(Contact).filter(
                Contact.account_id == tenant_id
            ).all()
    ```
    """
    pass
