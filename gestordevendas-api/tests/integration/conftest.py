"""
Configuração dos testes de integração.
Rodam contra a API real — necessita backend + banco de dados ligados.
"""
import os
import pytest
import httpx
from dotenv import load_dotenv

# Carrega .env.test se existir, senão usa .env normal
load_dotenv(".env.test", override=True)
load_dotenv(".env", override=False)


@pytest.fixture(scope="session")
def base_url() -> str:
    return os.getenv("TEST_BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def auth_token(base_url: str) -> str:
    """Obtém JWT via Supabase Auth para os testes."""
    import requests
    supabase_url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    email = os.environ["TEST_USER_EMAIL"]
    password = os.environ["TEST_USER_PASSWORD"]

    resp = requests.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": anon_key, "Content-Type": "application/json"},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def client(base_url: str, auth_token: str) -> httpx.Client:
    """Cliente HTTP com auth injetado — reutilizado na sessão inteira."""
    return httpx.Client(
        base_url=base_url,
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=30.0,
    )


@pytest.fixture(scope="session")
def account_id() -> str:
    return os.environ["TEST_ACCOUNT_ID"]
