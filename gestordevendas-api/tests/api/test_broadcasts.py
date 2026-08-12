"""Testes para Broadcasts Module (Task 3, Fase 3)"""
import pytest


class TestBroadcasts:
    """Testes de broadcasts"""

    def test_create_broadcast(self, client, auth_headers):
        """Criar broadcast"""
        broadcast_data = {
            "name": "Promoção de verão",
            "message_template_id": "template-promo",
            "recipient_filter": {"tag": "leads"},
        }

        response = client.post(
            "/broadcasts/",
            json=broadcast_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        assert data["name"] == "Promoção de verão"
        assert data["status"] == "draft"

    def test_list_broadcasts(self, client, auth_headers):
        """Listar broadcasts"""
        client.post(
            "/broadcasts/",
            json={
                "name": "Test",
                "message_template_id": "template-123",
                "recipient_filter": {},
            },
            headers=auth_headers,
        )

        response = client.get("/broadcasts/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "broadcasts" in data
        assert data["total"] >= 1

    def test_get_broadcast(self, client, auth_headers):
        """Obter broadcast"""
        create_response = client.post(
            "/broadcasts/",
            json={
                "name": "Get Test",
                "message_template_id": "template-123",
                "recipient_filter": {},
            },
            headers=auth_headers,
        )
        broadcast_id = create_response.json()["id"]

        response = client.get(f"/broadcasts/{broadcast_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == broadcast_id

    def test_update_broadcast(self, client, auth_headers):
        """Atualizar broadcast"""
        create_response = client.post(
            "/broadcasts/",
            json={
                "name": "Original",
                "message_template_id": "template-123",
                "recipient_filter": {},
            },
            headers=auth_headers,
        )
        broadcast_id = create_response.json()["id"]

        response = client.patch(
            f"/broadcasts/{broadcast_id}",
            json={"name": "Updated"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated"

    def test_delete_broadcast(self, client, auth_headers):
        """Deletar broadcast"""
        create_response = client.post(
            "/broadcasts/",
            json={
                "name": "To Delete",
                "message_template_id": "template-123",
                "recipient_filter": {},
            },
            headers=auth_headers,
        )
        broadcast_id = create_response.json()["id"]

        response = client.delete(f"/broadcasts/{broadcast_id}", headers=auth_headers)
        assert response.status_code == 204

        get_response = client.get(f"/broadcasts/{broadcast_id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_get_broadcast_stats(self, client, auth_headers):
        """Obter estatísticas"""
        create_response = client.post(
            "/broadcasts/",
            json={
                "name": "Stats Test",
                "message_template_id": "template-123",
                "recipient_filter": {},
            },
            headers=auth_headers,
        )
        broadcast_id = create_response.json()["id"]

        response = client.get(f"/broadcasts/{broadcast_id}/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "total" in data
        assert "sent" in data
        assert "failed" in data
        assert "success_rate" in data

    def test_unauthorized_broadcasts(self, client):
        """Sem autenticação"""
        response = client.get("/broadcasts/")
        assert response.status_code == 401

    def test_send_broadcast(self, client, auth_headers):
        """Enviar broadcast"""
        create_response = client.post(
            "/broadcasts/",
            json={
                "name": "Send Test",
                "message_template_id": "template-123",
                "recipient_filter": {},
            },
            headers=auth_headers,
        )
        broadcast_id = create_response.json()["id"]

        response = client.post(
            f"/broadcasts/{broadcast_id}/send",
            headers=auth_headers,
        )
        assert response.status_code == 200
