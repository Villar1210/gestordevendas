"""Testes para Chatbot Flows (Task 2, Fase 4)"""
import pytest


class TestChatbotFlows:
    """Testes de flows"""

    def test_create_flow(self, client, auth_headers):
        """Criar flow"""
        flow_data = {
            "name": "Atendimento ao cliente",
            "description": "Flow para suporte",
            "nodes": [],
            "edges": [],
        }

        response = client.post(
            "/flows/",
            json=flow_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        assert data["name"] == "Atendimento ao cliente"
        assert data["is_active"] == True

    def test_list_flows(self, client, auth_headers):
        """Listar flows"""
        client.post(
            "/flows/",
            json={"name": "Test Flow", "nodes": [], "edges": []},
            headers=auth_headers,
        )

        response = client.get("/flows/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "flows" in data
        assert data["total"] >= 1

    def test_get_flow(self, client, auth_headers):
        """Obter flow"""
        create_response = client.post(
            "/flows/",
            json={"name": "Get Test", "nodes": [], "edges": []},
            headers=auth_headers,
        )
        flow_id = create_response.json()["id"]

        response = client.get(f"/flows/{flow_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == flow_id

    def test_delete_flow(self, client, auth_headers):
        """Deletar flow"""
        create_response = client.post(
            "/flows/",
            json={"name": "Delete Test", "nodes": [], "edges": []},
            headers=auth_headers,
        )
        flow_id = create_response.json()["id"]

        response = client.delete(f"/flows/{flow_id}", headers=auth_headers)
        assert response.status_code == 204

        get_response = client.get(f"/flows/{flow_id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_unauthorized_flows(self, client):
        """Sem autenticação"""
        response = client.get("/flows/")
        assert response.status_code == 401
