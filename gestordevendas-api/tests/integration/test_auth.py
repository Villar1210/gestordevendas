"""
Testes de integração — Auth & Team management.

Requer backend rodando + variáveis em .env.test:
  TEST_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
  TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_ACCOUNT_ID
"""
import uuid
import pytest
import httpx


# ─── /api/auth/me ────────────────────────────────────────────────────────────

class TestAuthMe:
    def test_get_me_returns_200(self, client: httpx.Client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200

    def test_get_me_shape(self, client: httpx.Client):
        data = client.get("/api/auth/me").json()
        required_fields = {"id", "email", "role", "account_id", "account"}
        assert required_fields.issubset(data.keys()), f"Campos ausentes: {required_fields - data.keys()}"

    def test_get_me_account_nested(self, client: httpx.Client):
        account = client.get("/api/auth/me").json()["account"]
        assert "id" in account
        assert "name" in account
        assert "plan" in account

    def test_get_me_role_is_valid(self, client: httpx.Client):
        role = client.get("/api/auth/me").json()["role"]
        assert role in {"owner", "admin", "agent", "viewer"}

    def test_get_me_without_token_returns_401(self, base_url: str):
        anon = httpx.Client(base_url=base_url, timeout=10.0)
        resp = anon.get("/api/auth/me")
        assert resp.status_code == 401


# ─── /api/auth/me PATCH ──────────────────────────────────────────────────────

class TestUpdateMe:
    def test_update_full_name(self, client: httpx.Client):
        new_name = f"Teste Integração {uuid.uuid4().hex[:6]}"
        resp = client.patch("/api/auth/me", json={"full_name": new_name})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_update_empty_body_returns_400(self, client: httpx.Client):
        # Nenhum campo preenchido
        resp = client.patch("/api/auth/me", json={})
        assert resp.status_code == 400

    def test_update_invalid_token_returns_401(self, base_url: str):
        anon = httpx.Client(base_url=base_url, timeout=10.0)
        resp = anon.patch("/api/auth/me", json={"full_name": "X"})
        assert resp.status_code == 401


# ─── /api/auth/register ──────────────────────────────────────────────────────

class TestRegister:
    """
    ATENÇÃO: estes testes criam contas reais no Supabase.
    O cleanup (deletar o usuário) exige service_role — não está no conftest
    por segurança. Se rodar muitas vezes, haverá e-mails de teste acumulados
    no projeto Supabase (sem impacto funcional — apenas na listagem de usuários).
    Para limpar: Dashboard Supabase → Authentication → Users.
    """

    def test_register_success(self, base_url: str):
        """Cria uma nova conta completa e verifica a resposta."""
        client = httpx.Client(base_url=base_url, timeout=15.0)
        unique = uuid.uuid4().hex[:8]
        payload = {
            "company_name": f"Empresa Teste {unique}",
            "full_name": f"Usuário {unique}",
            "email": f"test_{unique}@example.com",
            "password": "SenhaSegura123!",
        }
        resp = client.post("/api/auth/register", json=payload)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["ok"] is True
        assert "account_id" in data

    def test_register_duplicate_email_returns_409(self, base_url: str):
        """Tentativa de cadastro com o mesmo e-mail retorna 409."""
        client = httpx.Client(base_url=base_url, timeout=15.0)
        unique = uuid.uuid4().hex[:8]
        payload = {
            "company_name": f"Empresa {unique}",
            "full_name": f"Nome {unique}",
            "email": f"dup_{unique}@example.com",
            "password": "SenhaSegura123!",
        }
        # Primeiro cadastro deve funcionar
        r1 = client.post("/api/auth/register", json=payload)
        assert r1.status_code == 201, r1.text

        # Segundo com mesmo e-mail deve falhar
        r2 = client.post("/api/auth/register", json=payload)
        assert r2.status_code == 409, r2.text

    def test_register_short_password_returns_422(self, base_url: str):
        """Senha com menos de 8 caracteres deve ser rejeitada pelo schema."""
        client = httpx.Client(base_url=base_url, timeout=10.0)
        resp = client.post("/api/auth/register", json={
            "company_name": "Teste",
            "full_name": "Teste Nome",
            "email": "test@example.com",
            "password": "123",           # < 8 chars
        })
        assert resp.status_code == 422

    def test_register_invalid_email_returns_422(self, base_url: str):
        """E-mail inválido deve ser rejeitado pelo schema Pydantic."""
        client = httpx.Client(base_url=base_url, timeout=10.0)
        resp = client.post("/api/auth/register", json={
            "company_name": "Teste",
            "full_name": "Teste Nome",
            "email": "nao-e-um-email",
            "password": "SenhaSegura123!",
        })
        assert resp.status_code == 422

    def test_register_missing_fields_returns_422(self, base_url: str):
        """Payload incompleto deve retornar 422."""
        client = httpx.Client(base_url=base_url, timeout=10.0)
        resp = client.post("/api/auth/register", json={"email": "x@y.com"})
        assert resp.status_code == 422


# ─── /api/team ───────────────────────────────────────────────────────────────

class TestTeam:
    def test_list_team_requires_admin(self, client: httpx.Client):
        """
        O usuário de teste deve ter role owner ou admin — a fixture 'client' usa
        TEST_USER_EMAIL que deve ser owner da conta de teste.
        """
        resp = client.get("/api/team")
        assert resp.status_code == 200

    def test_list_team_shape(self, client: httpx.Client):
        members = client.get("/api/team").json()
        assert isinstance(members, list)
        if members:
            first = members[0]
            assert "id" in first
            assert "email" in first
            assert "role" in first
            assert "is_current_user" in first

    def test_list_team_without_token_returns_401(self, base_url: str):
        anon = httpx.Client(base_url=base_url, timeout=10.0)
        resp = anon.get("/api/team")
        assert resp.status_code == 401

    def test_invite_missing_email_returns_422(self, client: httpx.Client):
        resp = client.post("/api/team/invite", json={"full_name": "Sem Email", "role": "agent"})
        assert resp.status_code == 422

    def test_invite_invalid_role_returns_422(self, client: httpx.Client):
        resp = client.post("/api/team/invite", json={
            "email": "agent@example.com",
            "full_name": "Agente Teste",
            "role": "superadmin",   # role inválida
        })
        assert resp.status_code == 422

    def test_update_own_role_returns_400(self, client: httpx.Client):
        """Usuário não pode alterar a própria role."""
        me = client.get("/api/auth/me").json()
        resp = client.patch(f"/api/team/{me['id']}/role", json={"role": "agent"})
        assert resp.status_code == 400

    def test_update_role_nonexistent_member_returns_404(self, client: httpx.Client):
        fake_id = str(uuid.uuid4())
        resp = client.patch(f"/api/team/{fake_id}/role", json={"role": "agent"})
        assert resp.status_code == 404

    def test_remove_self_returns_400(self, client: httpx.Client):
        """Usuário não pode se remover."""
        me = client.get("/api/auth/me").json()
        resp = client.delete(f"/api/team/{me['id']}")
        assert resp.status_code == 400

    def test_remove_nonexistent_member_returns_404(self, client: httpx.Client):
        fake_id = str(uuid.uuid4())
        resp = client.delete(f"/api/team/{fake_id}")
        assert resp.status_code == 404
