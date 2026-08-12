"""Testes para Billing Module (Task 1, Fase 5)"""
import pytest


class TestBilling:
    """Testes de billing"""

    def test_list_plans(self, client, auth_headers):
        """Listar planos"""
        response = client.get("/billing/plans")
        assert response.status_code == 200
        data = response.json()

        assert "plans" in data
        assert len(data["plans"]) >= 1

    def test_list_plans_has_free(self, client):
        """Planos incluem Free"""
        response = client.get("/billing/plans")
        data = response.json()
        plan_ids = [p["id"] for p in data["plans"]]

        assert "free" in plan_ids

    def test_setup_billing(self, client, auth_headers):
        """Configurar faturamento"""
        billing_data = {
            "billing_email": "test@example.com",
            "billing_name": "Test Company",
        }

        response = client.post(
            "/billing/setup",
            json=billing_data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["billing_email"] == billing_data["billing_email"]
        assert data["billing_name"] == billing_data["billing_name"]

    def test_subscribe(self, client, auth_headers):
        """Iniciar subscrição"""
        response = client.post(
            "/billing/subscribe?plan_id=starter",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_subscribe_invalid_plan(self, client, auth_headers):
        """Subscrição com plano inválido"""
        response = client.post(
            "/billing/subscribe?plan_id=invalid",
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_list_invoices(self, client, auth_headers):
        """Listar faturas"""
        response = client.get("/billing/invoices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "invoices" in data
        assert "total" in data

    def test_unauthorized_billing(self, client):
        """Sem autenticação"""
        response = client.post("/billing/subscribe?plan_id=starter")
        assert response.status_code == 401
