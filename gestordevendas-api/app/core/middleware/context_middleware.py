"""
Middleware que popula RequestContext automaticamente em cada requisição.

Este middleware executa APÓS a autenticação, garantindo que:
1. Cada requisição tem um RequestContext definido
2. O contexto está disponível em todo o código da requisição
3. O contexto é limpo após a resposta
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.core.context import RequestContext, set_context, clear_context, get_context
from app.core.dependencies import CurrentUser


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware que popula o contexto de requisição com informações do usuário.

    Ordem de execução importante:
    1. Este middleware deve executar APÓS AuthMiddleware
    2. Precisa ter acesso ao user (via request.state.user)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """Processa requisição e popula contexto."""

        # Endpoints públicos (sem auth) — ignorar
        public_paths = ["/health", "/docs", "/openapi.json", "/api/auth/login"]
        if any(request.url.path.startswith(path) for path in public_paths):
            return await call_next(request)

        try:
            # Extrair informações de autenticação já validadas
            # Essas informações vêm do middleware de autenticação anterior
            user_id = getattr(request.state, "user_id", None)
            email = getattr(request.state, "email", None)
            role = getattr(request.state, "role", None)
            tenant_id = getattr(request.state, "account_id", None)  # account_id é o tenant_id
            is_super_admin = role == "super_admin"

            # Extrair metadados da request
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

            # Criar contexto
            if user_id:  # Só criar contexto se autenticado
                ctx = RequestContext(
                    request_id=None,  # Será gerado automaticamente
                    user_id=user_id,
                    email=email or "",
                    tenant_id=tenant_id,
                    role=role or "viewer",
                    is_super_admin=is_super_admin,
                    timestamp=None,  # Será definido automaticamente
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                set_context(ctx)

                # Armazenar request_id na response para rastreamento
                request.state.request_id = ctx.request_id

        except Exception as e:
            # Log do erro (implementar depois com logger)
            print(f"⚠️  Erro ao criar RequestContext: {e}")
            pass

        try:
            response = await call_next(request)

            # Adicionar request_id aos headers para rastreamento
            ctx = get_context()
            if ctx:
                response.headers["X-Request-ID"] = ctx.request_id

            return response
        finally:
            # Sempre limpar contexto após processar
            clear_context()


# ─── Helpers para testes ────────────────────────────────────────────────────

def create_test_context(
    user_id: str = "test-user",
    email: str = "test@example.com",
    role: str = "owner",
    tenant_id: str = "test-tenant",
    is_super_admin: bool = False,
) -> RequestContext:
    """Criar contexto de teste."""
    return RequestContext(
        request_id=None,  # Será gerado
        user_id=user_id,
        email=email,
        tenant_id=tenant_id,
        role=role,
        is_super_admin=is_super_admin,
        timestamp=None,  # Será gerado
    )
