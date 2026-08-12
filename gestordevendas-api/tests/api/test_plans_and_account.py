"""Testes para Plans & Account Management (Task 2 & 3, Fase 5)"""
import pytest


class TestPlans:
    """Testes de planos"""

    def test_list_plans(self, client):
        """Listar planos"""
        response = client.get("/plans")
        assert response.status_code == 200
        data = response.json()

        assert len(data) >= 4  # free, starter, professional, enterprise
        assert data[0]["id"] == "free"

    def test_list_plans_free_is_zero(self, client):
        """Plano gratuito tem preço 0"""
        response = client.get("/plans")
        plans = response.json()
        free_plan = [p for p in plans if p["id"] == "free"][0]

        assert free_plan["price"] == 0

    def test_subscribe_to_plan(self, client, auth_headers):
        """Inscrever-se em um plano"""
        response = client.post(
            "/plans/subscribe",
            json={"plan_id": "starter"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["plan_id"] == "starter"
        assert data["plan_name"] == "Iniciante"
        assert data["status"] == "active"

    def test_subscribe_invalid_plan(self, client, auth_headers):
        """Inscrever em plano inválido"""
        response = client.post(
            "/plans/subscribe",
            json={"plan_id": "invalid"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_get_current_subscription(self, client, auth_headers):
        """Obter subscrição atual"""
        response = client.get("/plans/current", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "plan_id" in data
        assert "account_id" in data

    def test_cancel_subscription(self, client, auth_headers):
        """Cancelar subscrição"""
        response = client.post("/plans/cancel", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True

    def test_get_usage(self, client, auth_headers):
        """Obter uso atual"""
        response = client.get("/plans/usage", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "contacts_used" in data
        assert "contacts_limit" in data
        assert "users_used" in data
        assert "users_limit" in data


class TestAccount:
    """Testes de account management"""

    def test_get_profile(self, client, auth_headers):
        """Obter perfil"""
        response = client.get("/account/profile", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "id" in data
        assert "email" in data
        assert "name" in data

    def test_update_profile(self, client, auth_headers):
        """Atualizar perfil"""
        response = client.patch(
            "/account/profile",
            json={"name": "New Name", "avatar_url": None},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["name"] == "New Name"

    def test_change_password(self, client, auth_headers):
        """Trocar senha"""
        response = client.post(
            "/account/change-password",
            json={
                "current_password": "current123",
                "new_password": "newpassword123",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True

    def test_list_team_members(self, client, auth_headers):
        """Listar membros da equipe"""
        response = client.get("/account/team", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)

    def test_get_account_settings(self, client, auth_headers):
        """Obter configurações"""
        response = client.get("/account/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "timezone" in data
        assert "language" in data

    def test_update_account_settings(self, client, auth_headers):
        """Atualizar configurações"""
        response = client.patch(
            "/account/settings",
            json={
                "company_name": "New Company",
                "timezone": "America/New_York",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["company_name"] == "New Company"

    def test_unauthorized_account_access(self, client):
        """Sem autenticação"""
        response = client.get("/account/profile")
        assert response.status_code == 401
