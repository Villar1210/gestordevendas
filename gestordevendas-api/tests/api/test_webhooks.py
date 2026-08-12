"""Testes para Webhooks Module (Task 1, Fase 3)"""
import pytest


class TestWebhooks:
    """Testes de endpoints de webhooks"""

    def test_create_webhook(self, client, auth_headers):
        """Criar novo webhook"""
        webhook_data = {
            "name": "Novo contato",
            "description": "Notificar quando contato é criado",
            "url": "https://example.com/webhooks/contact",
            "events": ["contact_created"],
            "retry_count": 3,
            "timeout_seconds": 30,
        }

        response = client.post(
            "/webhooks/",
            json=webhook_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        assert data["name"] == webhook_data["name"]
        assert data["url"] == webhook_data["url"]
        assert "secret" in data
        assert data["active"] == True

    def test_create_webhook_invalid_url(self, client, auth_headers):
        """Criar webhook com URL inválida"""
        webhook_data = {
            "name": "Webhook inválido",
            "url": "not-a-url",
            "events": ["contact_created"],
        }

        response = client.post(
            "/webhooks/",
            json=webhook_data,
            headers=auth_headers,
        )
        assert response.status_code in [400, 422]

    def test_list_webhooks(self, client, auth_headers):
        """Listar webhooks"""
        # Criar webhook primeiro
        client.post(
            "/webhooks/",
            json={
                "name": "Test Webhook",
                "url": "https://example.com/test",
                "events": ["contact_created"],
            },
            headers=auth_headers,
        )

        response = client.get("/webhooks/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "webhooks" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_list_webhooks_pagination(self, client, auth_headers):
        """Listar webhooks com paginação"""
        response = client.get(
            "/webhooks/?limit=10&offset=0",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["limit"] == 10
        assert data["offset"] == 0

    def test_get_webhook(self, client, auth_headers):
        """Obter webhook específico"""
        # Criar webhook
        create_response = client.post(
            "/webhooks/",
            json={
                "name": "Get Test",
                "url": "https://example.com/get-test",
                "events": ["message_received"],
            },
            headers=auth_headers,
        )
        webhook_id = create_response.json()["id"]

        # Obter webhook
        response = client.get(f"/webhooks/{webhook_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == webhook_id
        assert data["name"] == "Get Test"

    def test_get_webhook_not_found(self, client, auth_headers):
        """Obter webhook que não existe"""
        response = client.get(
            "/webhooks/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_webhook(self, client, auth_headers):
        """Atualizar webhook"""
        # Criar webhook
        create_response = client.post(
            "/webhooks/",
            json={
                "name": "Original",
                "url": "https://example.com/original",
                "events": ["contact_created"],
            },
            headers=auth_headers,
        )
        webhook_id = create_response.json()["id"]

        # Atualizar
        update_data = {
            "name": "Updated",
            "active": False,
        }
        response = client.patch(
            f"/webhooks/{webhook_id}",
            json=update_data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["name"] == "Updated"
        assert data["active"] == False

    def test_delete_webhook(self, client, auth_headers):
        """Deletar webhook"""
        # Criar webhook
        create_response = client.post(
            "/webhooks/",
            json={
                "name": "To Delete",
                "url": "https://example.com/delete",
                "events": ["contact_created"],
            },
            headers=auth_headers,
        )
        webhook_id = create_response.json()["id"]

        # Deletar
        response = client.delete(f"/webhooks/{webhook_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verificar que foi deletado
        get_response = client.get(f"/webhooks/{webhook_id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_get_webhook_logs(self, client, auth_headers):
        """Obter logs de webhook"""
        # Criar webhook
        create_response = client.post(
            "/webhooks/",
            json={
                "name": "Logs Test",
                "url": "https://example.com/logs",
                "events": ["contact_created"],
            },
            headers=auth_headers,
        )
        webhook_id = create_response.json()["id"]

        # Obter logs
        response = client.get(
            f"/webhooks/{webhook_id}/logs",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)

    def test_test_webhook(self, client, auth_headers):
        """Testar webhook"""
        # Criar webhook
        create_response = client.post(
            "/webhooks/",
            json={
                "name": "Test Webhook",
                "url": "https://httpbin.org/post",  # URL pública que aceita POST
                "events": ["test"],
            },
            headers=auth_headers,
        )
        webhook_id = create_response.json()["id"]

        # Testar webhook
        test_data = {
            "event_type": "test",
            "test_payload": {"message": "test"},
        }
        response = client.post(
            f"/webhooks/{webhook_id}/test",
            json=test_data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert "success" in data
        assert "response_time_ms" in data

    def test_unauthorized_webhooks(self, client):
        """Sem autenticação, não pode acessar webhooks"""
        response = client.get("/webhooks/")
        assert response.status_code == 401

    def test_create_webhook_requires_url(self, client, auth_headers):
        """Criar webhook sem URL falha"""
        webhook_data = {
            "name": "No URL",
            "events": ["contact_created"],
        }

        response = client.post(
            "/webhooks/",
            json=webhook_data,
            headers=auth_headers,
        )
        assert response.status_code in [400, 422]

    def test_webhook_multiple_events(self, client, auth_headers):
        """Webhook pode escutar múltiplos eventos"""
        webhook_data = {
            "name": "Multi Event",
            "url": "https://example.com/multi",
            "events": ["contact_created", "message_received", "lead_qualified"],
        }

        response = client.post(
            "/webhooks/",
            json=webhook_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        assert len(data["events"]) == 3
        assert "contact_created" in data["events"]
