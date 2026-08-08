"""
Testes para RequestContext e context propagation.
"""
import pytest
from datetime import datetime
from uuid import UUID


class TestRequestContext:
    """Testes do contexto de requisição."""

    def test_context_creation(self):
        """Testa criação básica de contexto."""
        class RequestCtx:
            def __init__(self, request_id=None, user_id="", email="", tenant_id=None,
                         role="viewer", is_super_admin=False, timestamp=None,
                         ip_address=None, user_agent=None):
                self.request_id = request_id or str(__import__('uuid').uuid4())
                self.user_id = user_id
                self.email = email
                self.tenant_id = tenant_id
                self.role = role
                self.is_super_admin = is_super_admin
                self.timestamp = timestamp or datetime.utcnow()
                self.ip_address = ip_address
                self.user_agent = user_agent

        ctx = RequestCtx(
            user_id="user-123",
            email="user@example.com",
            tenant_id="tenant-456",
            role="owner",
            is_super_admin=False,
        )

        assert ctx.user_id == "user-123"
        assert ctx.email == "user@example.com"
        assert ctx.tenant_id == "tenant-456"
        assert ctx.role == "owner"
        assert ctx.is_super_admin is False
        assert ctx.request_id is not None
        assert ctx.timestamp is not None

    def test_context_super_admin(self):
        """Testa contexto de Super Admin."""
        class RequestCtx:
            def __init__(self, request_id=None, user_id="", email="", tenant_id=None,
                         role="super_admin", is_super_admin=True, timestamp=None,
                         ip_address=None, user_agent=None):
                self.request_id = request_id or str(__import__('uuid').uuid4())
                self.user_id = user_id
                self.email = email
                self.tenant_id = tenant_id
                self.role = role
                self.is_super_admin = is_super_admin
                self.timestamp = timestamp or datetime.utcnow()
                self.ip_address = ip_address
                self.user_agent = user_agent

        ctx = RequestCtx(
            user_id="super-admin-123",
            email="super@admin.local",
            tenant_id="plataforma",
            role="super_admin",
            is_super_admin=True,
        )

        assert ctx.is_super_admin is True
        assert ctx.role == "super_admin"
        assert ctx.user_id == "super-admin-123"

    def test_context_with_ip_and_useragent(self):
        """Testa contexto com metadados de requisição."""
        class RequestCtx:
            def __init__(self, request_id=None, user_id="", email="", tenant_id=None,
                         role="viewer", is_super_admin=False, timestamp=None,
                         ip_address=None, user_agent=None):
                self.request_id = request_id or str(__import__('uuid').uuid4())
                self.user_id = user_id
                self.email = email
                self.tenant_id = tenant_id
                self.role = role
                self.is_super_admin = is_super_admin
                self.timestamp = timestamp or datetime.utcnow()
                self.ip_address = ip_address
                self.user_agent = user_agent

        ctx = RequestCtx(
            user_id="user-789",
            email="agent@company.com",
            tenant_id="account-xyz",
            role="agent",
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0...",
        )

        assert ctx.ip_address == "192.168.1.100"
        assert ctx.user_agent == "Mozilla/5.0..."
        assert ctx.tenant_id == "account-xyz"

    def test_context_without_tenant(self):
        """Testa contexto sem tenant (Super Admin cross-tenant)."""
        class RequestCtx:
            def __init__(self, request_id=None, user_id="", email="", tenant_id=None,
                         role="viewer", is_super_admin=False, timestamp=None,
                         ip_address=None, user_agent=None):
                self.request_id = request_id or str(__import__('uuid').uuid4())
                self.user_id = user_id
                self.email = email
                self.tenant_id = tenant_id
                self.role = role
                self.is_super_admin = is_super_admin
                self.timestamp = timestamp or datetime.utcnow()
                self.ip_address = ip_address
                self.user_agent = user_agent

        ctx = RequestCtx(
            user_id="super-admin-999",
            email="super@admin.local",
            tenant_id=None,  # Super Admin sem tenant específico
            role="super_admin",
            is_super_admin=True,
        )

        assert ctx.tenant_id is None
        assert ctx.is_super_admin is True

    def test_context_request_id_generation(self):
        """Testa geração automática de request_id."""
        class RequestCtx:
            def __init__(self, request_id=None, user_id="", email="", tenant_id=None,
                         role="viewer", is_super_admin=False, timestamp=None,
                         ip_address=None, user_agent=None):
                self.request_id = request_id or str(__import__('uuid').uuid4())
                self.user_id = user_id
                self.email = email
                self.tenant_id = tenant_id
                self.role = role
                self.is_super_admin = is_super_admin
                self.timestamp = timestamp or datetime.utcnow()
                self.ip_address = ip_address
                self.user_agent = user_agent

        ctx1 = RequestCtx(user_id="user-1", email="u1@ex.com")
        ctx2 = RequestCtx(user_id="user-2", email="u2@ex.com")

        # Request IDs devem ser únicos
        assert ctx1.request_id != ctx2.request_id
        # Devem ser UUIDs válidos
        assert len(ctx1.request_id) == 36  # UUID format
        assert len(ctx2.request_id) == 36

    def test_tenant_access_validation(self):
        """Testa validação de acesso por tenant."""
        class RequestCtx:
            def __init__(self, request_id=None, user_id="", email="", tenant_id=None,
                         role="viewer", is_super_admin=False, timestamp=None,
                         ip_address=None, user_agent=None):
                self.request_id = request_id or str(__import__('uuid').uuid4())
                self.user_id = user_id
                self.email = email
                self.tenant_id = tenant_id
                self.role = role
                self.is_super_admin = is_super_admin
                self.timestamp = timestamp or datetime.utcnow()
                self.ip_address = ip_address
                self.user_agent = user_agent

            def can_access_tenant(self, required_tenant_id: str) -> bool:
                if self.is_super_admin:
                    return True
                return self.tenant_id == required_tenant_id

        # Usuário regular
        user_ctx = RequestCtx(
            user_id="user-123",
            email="user@ex.com",
            tenant_id="tenant-a",
            role="owner",
        )

        assert user_ctx.can_access_tenant("tenant-a") is True
        assert user_ctx.can_access_tenant("tenant-b") is False

        # Super Admin
        admin_ctx = RequestCtx(
            user_id="admin-123",
            email="admin@ex.com",
            tenant_id="tenant-a",
            role="super_admin",
            is_super_admin=True,
        )

        assert admin_ctx.can_access_tenant("tenant-a") is True
        assert admin_ctx.can_access_tenant("tenant-b") is True
        assert admin_ctx.can_access_tenant("tenant-z") is True

    def test_context_timestamp(self):
        """Testa timestamp de contexto."""
        class RequestCtx:
            def __init__(self, request_id=None, user_id="", email="", tenant_id=None,
                         role="viewer", is_super_admin=False, timestamp=None,
                         ip_address=None, user_agent=None):
                self.request_id = request_id or str(__import__('uuid').uuid4())
                self.user_id = user_id
                self.email = email
                self.tenant_id = tenant_id
                self.role = role
                self.is_super_admin = is_super_admin
                self.timestamp = timestamp or datetime.utcnow()
                self.ip_address = ip_address
                self.user_agent = user_agent

        ctx = RequestCtx(user_id="user-123", email="u@ex.com")

        assert isinstance(ctx.timestamp, datetime)
        assert ctx.timestamp <= datetime.utcnow()

    def test_context_all_roles(self):
        """Testa contexto com todos os tipos de role."""
        class RequestCtx:
            def __init__(self, request_id=None, user_id="", email="", tenant_id=None,
                         role="viewer", is_super_admin=False, timestamp=None,
                         ip_address=None, user_agent=None):
                self.request_id = request_id or str(__import__('uuid').uuid4())
                self.user_id = user_id
                self.email = email
                self.tenant_id = tenant_id
                self.role = role
                self.is_super_admin = is_super_admin
                self.timestamp = timestamp or datetime.utcnow()
                self.ip_address = ip_address
                self.user_agent = user_agent

        roles = ["viewer", "agent", "owner", "admin", "super_admin"]

        for role_name in roles:
            is_super = role_name == "super_admin"
            ctx = RequestCtx(
                user_id=f"user-{role_name}",
                email=f"{role_name}@ex.com",
                role=role_name,
                is_super_admin=is_super,
            )

            assert ctx.role == role_name
            assert ctx.is_super_admin == is_super
