"""
Exceções de domínio.
Sem dependência de FastAPI — o handler de erros no main.py faz o mapeamento.
"""


class DomainError(Exception):
    """Base para todos os erros de domínio."""
    def __init__(self, message: str = "Erro de domínio"):
        self.message = message
        super().__init__(message)


class UnauthorizedError(DomainError):
    """Usuário não autenticado."""
    def __init__(self, message: str = "Não autenticado"):
        super().__init__(message)


class ForbiddenError(DomainError):
    """Usuário autenticado mas sem permissão."""
    def __init__(self, message: str = "Acesso negado"):
        super().__init__(message)


class NotFoundError(DomainError):
    """Recurso não encontrado no tenant."""
    def __init__(self, resource: str = "Recurso", resource_id: str = ""):
        msg = f"{resource} não encontrado"
        if resource_id:
            msg += f" (id={resource_id})"
        super().__init__(msg)


class ConflictError(DomainError):
    """Conflito — ex: e-mail duplicado, telefone já cadastrado."""
    def __init__(self, message: str = "Conflito de dados"):
        super().__init__(message)


class ValidationError(DomainError):
    """Dados inválidos detectados na camada de domínio."""
    def __init__(self, message: str = "Dados inválidos"):
        super().__init__(message)


class RateLimitError(DomainError):
    """Rate limit atingido (ex: auto-reply IA por conversa)."""
    def __init__(self, message: str = "Limite de requisições atingido"):
        super().__init__(message)


class ExternalServiceError(DomainError):
    """Falha em serviço externo (Meta API, OpenAI, Resend...)."""
    def __init__(self, service: str, message: str = ""):
        super().__init__(f"Erro no serviço {service}: {message}")


class TenantIsolationError(DomainError):
    """
    Tentativa de acesso a recurso de outro tenant.
    NUNCA deve acontecer — indica bug grave de segurança.
    """
    def __init__(self):
        super().__init__("Violação de isolamento multi-tenant")
