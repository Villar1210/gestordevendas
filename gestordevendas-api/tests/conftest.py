"""
Configuração global de testes do pytest.
Define fixtures e mocks reutilizáveis.
"""
import sys
import os
from unittest.mock import MagicMock, patch

# ─── Mocks globais ANTES de qualquer import de app ───────────────────────────

# Mock do módulo 'supabase'
sys.modules["supabase"] = MagicMock()
sys.modules["supabase.client"] = MagicMock()

# Mock de módulos opcionais que podem não estar instalados
sys.modules["jose"] = MagicMock()
sys.modules["fastapi_limiter"] = MagicMock()
sys.modules["fastapi_limiter.depends"] = MagicMock()
sys.modules["redis"] = MagicMock()
sys.modules["redis.asyncio"] = MagicMock()

# ─── Imports de teste após mocks ──────────────────────────────────────────────
import pytest
from datetime import datetime
from app.domain.enums import Role, Plan


# ─── Fixtures de teste ────────────────────────────────────────────────────────

@pytest.fixture
def super_admin_user():
    """Usuário Super Admin para testes."""
    # Importar aqui para evitar problemas com mocks
    from app.core.dependencies import CurrentUser
    return CurrentUser(
        user_id="super-admin-test-123",
        account_id="plataforma-test",
        role=Role.SUPER_ADMIN,
        email="test-super@admin.local",
    )


@pytest.fixture
def regular_user():
    """Usuário regular (não Super Admin) para testes."""
    from app.core.dependencies import CurrentUser
    return CurrentUser(
        user_id="regular-user-test-123",
        account_id="tenant-test",
        role=Role.OWNER,
        email="test-owner@tenant.local",
    )


@pytest.fixture
def now_iso():
    """Timestamp ISO atual para testes."""
    return datetime.utcnow().isoformat()
