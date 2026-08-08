"""
Audit Logging com Decorador Automático.

Registra automaticamente:
1. Quem fez a ação (user_id, email, role)
2. O quê foi feito (função, parâmetros)
3. Quando (timestamp, request_id)
4. De onde (IP, User-Agent)
5. Com sucesso ou erro
"""
from functools import wraps
from typing import Any, Callable, Optional, Dict
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import json
import inspect

from app.core.context import get_context, get_request_id


class AuditAction(str, Enum):
    """Tipos de ações auditadas."""

    # Super Admin
    SUPER_ADMIN_LIST_TENANTS = "super_admin_list_tenants"
    SUPER_ADMIN_GET_STATS = "super_admin_get_stats"
    SUPER_ADMIN_ASSUME_TENANT = "super_admin_assume_tenant"

    # Autenticação
    AUTH_LOGIN = "auth_login"
    AUTH_LOGOUT = "auth_logout"
    AUTH_TOKEN_REFRESH = "auth_token_refresh"

    # Contacts
    CONTACT_CREATE = "contact_create"
    CONTACT_UPDATE = "contact_update"
    CONTACT_DELETE = "contact_delete"
    CONTACT_BULK_IMPORT = "contact_bulk_import"

    # Campaigns
    CAMPAIGN_CREATE = "campaign_create"
    CAMPAIGN_UPDATE = "campaign_update"
    CAMPAIGN_DELETE = "campaign_delete"
    CAMPAIGN_LAUNCH = "campaign_launch"

    # Leads
    LEAD_CREATE = "lead_create"
    LEAD_UPDATE = "lead_update"
    LEAD_DELETE = "lead_delete"
    LEAD_CONVERT = "lead_convert"

    # Settings
    SETTINGS_UPDATE = "settings_update"
    USER_CREATE = "user_create"
    USER_DELETE = "user_delete"


@dataclass
class AuditLogEntry:
    """Entrada de log de auditoria."""

    # Identificadores
    request_id: str  # Vinculado com a requisição
    action: AuditAction
    timestamp: datetime

    # Ator
    actor_id: str  # user_id
    actor_email: str
    actor_role: str
    actor_ip: Optional[str]
    actor_user_agent: Optional[str]

    # Contexto
    tenant_id: Optional[str]
    resource_type: Optional[str]  # "contact", "campaign", etc
    resource_id: Optional[str]  # ID do recurso afetado
    action_details: Dict[str, Any]  # Parâmetros da ação

    # Resultado
    success: bool
    error_message: Optional[str] = None


class AuditLogger:
    """Logger de auditoria (em produção, seria um banco de dados)."""

    def __init__(self):
        self.entries: list[AuditLogEntry] = []

    async def log(self, entry: AuditLogEntry) -> None:
        """Registrar entrada de auditoria."""
        self.entries.append(entry)

        # Em produção, salvar no banco:
        # await db.create(AuditLogRecord, {
        #     "request_id": entry.request_id,
        #     "action": entry.action.value,
        #     "actor_id": entry.actor_id,
        #     "tenant_id": entry.tenant_id,
        #     "resource_type": entry.resource_type,
        #     "resource_id": entry.resource_id,
        #     "action_details": entry.action_details,
        #     "success": entry.success,
        #     "error_message": entry.error_message,
        #     "timestamp": entry.timestamp,
        # })

        # Log para stderr/stdout
        status = "✅ SUCCESS" if entry.success else "❌ FAILED"
        print(
            f"[{entry.request_id}] {status} {entry.action.value} "
            f"by {entry.actor_email} on {entry.resource_type}:{entry.resource_id}"
        )

    def get_entries(self, actor_id: Optional[str] = None) -> list[AuditLogEntry]:
        """Buscar entradas de auditoria (para testes)."""
        if actor_id:
            return [e for e in self.entries if e.actor_id == actor_id]
        return self.entries


# Instância global
_audit_logger = AuditLogger()


def get_audit_logger() -> AuditLogger:
    """Obter instância do audit logger."""
    return _audit_logger


def audit_action(
    action: AuditAction,
    resource_type: Optional[str] = None,
    extract_resource_id: Optional[Callable] = None,
) -> Callable:
    """
    Decorador para registrar ações automaticamente.

    Args:
        action: Tipo de ação sendo auditada
        resource_type: Tipo de recurso afetado (contact, campaign, etc)
        extract_resource_id: Função que extrai resource_id dos argumentos

    Exemplo:
        @audit_action(
            AuditAction.CONTACT_CREATE,
            resource_type="contact",
            extract_resource_id=lambda result, args: result.id
        )
        async def create_contact(contact_data: ContactData):
            # ...
            return contact

        @audit_action(
            AuditAction.CONTACT_DELETE,
            resource_type="contact",
            extract_resource_id=lambda result, args: args[0]  # contact_id
        )
        async def delete_contact(contact_id: str):
            # ...
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            ctx = get_context()
            logger = get_audit_logger()

            if not ctx:
                # Sem contexto, não auditar
                return await func(*args, **kwargs)

            resource_id = None
            error_message = None
            success = True

            try:
                # Executar ação
                result = await func(*args, **kwargs)

                # Extrair resource_id do resultado
                if extract_resource_id:
                    resource_id = extract_resource_id(result, args, kwargs)

                return result

            except Exception as e:
                success = False
                error_message = str(e)
                raise

            finally:
                # Registrar auditoria (sempre, sucesso ou erro)
                entry = AuditLogEntry(
                    request_id=ctx.request_id,
                    action=action,
                    timestamp=ctx.timestamp,
                    actor_id=ctx.user_id,
                    actor_email=ctx.email,
                    actor_role=ctx.role,
                    actor_ip=ctx.ip_address,
                    actor_user_agent=ctx.user_agent,
                    tenant_id=ctx.tenant_id,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    action_details={
                        "function": func.__name__,
                        "args_count": len(args),
                        "kwargs": list(kwargs.keys()),
                    },
                    success=success,
                    error_message=error_message,
                )

                await logger.log(entry)

        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            ctx = get_context()
            logger = get_audit_logger()

            if not ctx:
                return func(*args, **kwargs)

            resource_id = None
            error_message = None
            success = True

            try:
                result = func(*args, **kwargs)

                if extract_resource_id:
                    resource_id = extract_resource_id(result, args, kwargs)

                return result

            except Exception as e:
                success = False
                error_message = str(e)
                raise

            finally:
                entry = AuditLogEntry(
                    request_id=ctx.request_id,
                    action=action,
                    timestamp=ctx.timestamp,
                    actor_id=ctx.user_id,
                    actor_email=ctx.email,
                    actor_role=ctx.role,
                    actor_ip=ctx.ip_address,
                    actor_user_agent=ctx.user_agent,
                    tenant_id=ctx.tenant_id,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    action_details={
                        "function": func.__name__,
                        "args_count": len(args),
                        "kwargs": list(kwargs.keys()),
                    },
                    success=success,
                    error_message=error_message,
                )

                # Para funções síncronas, logar de forma síncrona
                # (em produção, usar uma fila)
                logger.entries.append(entry)

        # Decidir se é async ou sync
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


# ─── Exemplo de uso ───────────────────────────────────────────────────────

"""
# Em um repository ou service:

from app.core.audit_logging import audit_action, AuditAction

class ContactRepository:
    @audit_action(
        AuditAction.CONTACT_CREATE,
        resource_type="contact",
        extract_resource_id=lambda result, args, kwargs: result.id
    )
    async def create(self, contact_data: ContactData) -> Contact:
        # Criar contato...
        return contact

    @audit_action(
        AuditAction.CONTACT_DELETE,
        resource_type="contact",
        extract_resource_id=lambda result, args, kwargs: args[1]  # contact_id
    )
    async def delete(self, tenant_id: str, contact_id: str) -> None:
        # Deletar contato...

    @audit_action(
        AuditAction.CONTACT_BULK_IMPORT,
        resource_type="contact",
        extract_resource_id=lambda result, args, kwargs: f"bulk-{result.count}"
    )
    async def bulk_import(self, tenant_id: str, file_path: str) -> BulkResult:
        # Importar contatos...
        return result


# Em um endpoint:

@app.post("/contacts")
@audit_action(
    AuditAction.CONTACT_CREATE,
    resource_type="contact",
)
async def create_contact(data: ContactData):
    return await repo.create(data)
"""
