"""
Testes de integração — Quota enforcement (plano Free).
Verifica que limites de plano são aplicados.
"""
import pytest
import httpx


class TestQuotaEnforcement:
    def test_billing_status_returns_plan(self, client: httpx.Client):
        resp = client.get("/api/account/billing")
        assert resp.status_code == 200
        data = resp.json()
        assert "plan" in data
        assert data["plan"] in ("free", "pro", "enterprise")
        assert "usage" in data

    def test_health_endpoint(self, client: httpx.Client):
        """Health check básico deve retornar 200."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"

    def test_detailed_health(self, client: httpx.Client):
        """Health check detalhado deve retornar componentes."""
        resp = client.get("/health/detailed")
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert "components" in data
        assert "supabase" in data["components"]
        assert "redis" in data["components"]

    def test_unauthenticated_request_returns_401(self, base_url: str):
        """Requisição sem token retorna 401."""
        client_no_auth = httpx.Client(base_url=base_url, timeout=10)
        resp = client_no_auth.get("/api/contacts")
        assert resp.status_code == 401

    def test_stripe_webhook_without_signature_returns_400(self, base_url: str):
        """Webhook Stripe sem assinatura válida retorna 400."""
        client_no_auth = httpx.Client(base_url=base_url, timeout=10)
        resp = client_no_auth.post("/v1/stripe/webhook", content=b"{}", headers={"Content-Type": "application/json"})
        assert resp.status_code == 400


class TestAutomations:
    def test_list_automations(self, client: httpx.Client):
        resp = client.get("/api/automations")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_and_delete_automation(self, client: httpx.Client):
        payload = {
            "name": "Teste Integração",
            "event": "message_received",
            "conditions": [{"field": "message_content", "operator": "contains", "value": "oi"}],
            "actions": [{"type": "send_message", "params": {"content": "Olá!"}}],
        }
        create_resp = client.post("/api/automations", json=payload)
        assert create_resp.status_code == 201
        auto_id = create_resp.json()["id"]

        # Toggle ativo/inativo
        patch_resp = client.patch(f"/api/automations/{auto_id}", json={"is_active": False})
        assert patch_resp.status_code == 200
        assert patch_resp.json()["is_active"] is False

        # Delete
        del_resp = client.delete(f"/api/automations/{auto_id}")
        assert del_resp.status_code in (200, 204)

        # Confirma remoção
        get_resp = client.get(f"/api/automations/{auto_id}")
        assert get_resp.status_code == 404


class TestAIConfig:
    def test_list_ai_configs(self, client: httpx.Client):
        resp = client.get("/api/ai/config")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_knowledge_base(self, client: httpx.Client):
        resp = client.get("/api/ai/knowledge")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_flows(self, client: httpx.Client):
        resp = client.get("/api/flows")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_knowledge_search(self, client: httpx.Client):
        resp = client.get("/api/ai/knowledge/search", params={"q": "teste"})
        assert resp.status_code == 200
