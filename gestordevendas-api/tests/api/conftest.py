"""
Configuração local dos testes de API.
Define fixtures client e auth_headers.
"""
import os
import pytest
import httpx
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv(".env.test", override=True)
load_dotenv(".env", override=False)


@pytest.fixture(scope="session")
def base_url() -> str:
    """URL base da API."""
    return os.getenv("TEST_BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def auth_token(base_url: str) -> str:
    """Obtém JWT para testes (mock/real via Supabase)."""
    # Para testes locais sem Supabase, retornar token mock
    token = os.getenv("TEST_AUTH_TOKEN")
    if token:
        return token

    # Se houver credenciais Supabase, fazer login real
    try:
        import requests
        supabase_url = os.environ.get("SUPABASE_URL")
        anon_key = os.environ.get("SUPABASE_ANON_KEY")
        email = os.environ.get("TEST_USER_EMAIL", "test@test.local")
        password = os.environ.get("TEST_USER_PASSWORD", "test1234")

        if not supabase_url or not anon_key:
            return "test-token-mock"

        resp = requests.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            json={"email": email, "password": password},
            headers={"apikey": anon_key, "Content-Type": "application/json"},
        )
        if resp.status_code == 200:
            return resp.json()["access_token"]
    except Exception:
        pass

    return "test-token-mock"


@pytest.fixture
def client(base_url: str, auth_token: str):
    """Cliente HTTP síncrono com autorização."""
    with httpx.Client(
        base_url=base_url,
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=30.0,
    ) as http_client:
        yield http_client


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Headers com autenticação JWT."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }


@pytest.fixture
def test_account_id() -> str:
    """ID do account de teste."""
    return os.environ.get("TEST_ACCOUNT_ID", "test-account-123")
