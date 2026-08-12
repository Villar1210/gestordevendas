"""Testes para Automations Module (Task 2, Fase 3)"""
import pytest


class TestAutomations:
    """Testes de endpoints de automações"""

    def test_list_triggers(self, client, auth_headers):
        """Listar tipos de triggers disponíveis"""
        response = client.get("/automations/triggers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "triggers" in data
        assert "count" in data
        assert len(data["triggers"]) > 0

    def test_list_actions(self, client, auth_headers):
        """Listar tipos de ações disponíveis"""
        response = client.get("/automations/actions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "actions" in data
        assert "count" in data
        assert "send_message" in data["actions"]
        assert "send_email" in data["actions"]

    def test_create_automation(self, client, auth_headers):
        """Criar nova automação"""
        automation_data = {
            "name": "Enviar boas-vindas",
            "description": "Enviar email quando contato é criado",
            "trigger_type": "contact_created",
            "trigger_conditions": {},
            "actions": [
                {
                    "type": "send_email",
                    "parameters": {
                        "subject": "Bem-vindo!",
                        "body": "Bem-vindo ao nosso sistema",
                    }
                }
            ],
        }

        response = client.post(
            "/automations/",
            json=automation_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        assert data["name"] == automation_data["name"]
        assert data["trigger_type"] == "contact_created"
        assert data["active"] == True
        assert len(data["actions"]) == 1

    def test_create_automation_multiple_actions(self, client, auth_headers):
        """Criar automação com múltiplas ações"""
        automation_data = {
            "name": "Workflow completo",
            "trigger_type": "message_received",
            "actions": [
                {
                    "type": "send_message",
                    "parameters": {
                        "message_template_id": "template-123",
                        "delay_seconds": 0,
                    }
                },
                {
                    "type": "add_tag",
                    "parameters": {"tag_name": "respondido"}
                },
                {
                    "type": "create_task",
                    "parameters": {
                        "title": "Seguir up",
                        "description": "Verificar resposta",
                    }
                },
            ],
        }

        response = client.post(
            "/automations/",
            json=automation_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        assert len(data["actions"]) == 3

    def test_list_automations(self, client, auth_headers):
        """Listar automações"""
        # Criar automação primeiro
        client.post(
            "/automations/",
            json={
                "name": "Test Automation",
                "trigger_type": "contact_created",
                "actions": [],
            },
            headers=auth_headers,
        )

        response = client.get("/automations/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "automations" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_list_automations_active_only(self, client, auth_headers):
        """Listar apenas automações ativas"""
        response = client.get(
            "/automations/?active_only=true",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Todas devem estar ativas
        for automation in data["automations"]:
            assert automation["active"] == True

    def test_get_automation(self, client, auth_headers):
        """Obter automação específica"""
        # Criar automação
        create_response = client.post(
            "/automations/",
            json={
                "name": "Get Test",
                "trigger_type": "lead_qualified",
                "actions": [],
            },
            headers=auth_headers,
        )
        automation_id = create_response.json()["id"]

        # Obter automação
        response = client.get(f"/automations/{automation_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == automation_id
        assert data["name"] == "Get Test"

    def test_update_automation(self, client, auth_headers):
        """Atualizar automação"""
        # Criar automação
        create_response = client.post(
            "/automations/",
            json={
                "name": "Original Name",
                "trigger_type": "contact_created",
                "actions": [],
            },
            headers=auth_headers,
        )
        automation_id = create_response.json()["id"]

        # Atualizar
        update_data = {
            "name": "Updated Name",
            "active": False,
        }
        response = client.patch(
            f"/automations/{automation_id}",
            json=update_data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["name"] == "Updated Name"
        assert data["active"] == False

    def test_delete_automation(self, client, auth_headers):
        """Deletar automação"""
        # Criar automação
        create_response = client.post(
            "/automations/",
            json={
                "name": "To Delete",
                "trigger_type": "contact_created",
                "actions": [],
            },
            headers=auth_headers,
        )
        automation_id = create_response.json()["id"]

        # Deletar
        response = client.delete(f"/automations/{automation_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verificar que foi deletado
        get_response = client.get(f"/automations/{automation_id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_get_automation_logs(self, client, auth_headers):
        """Obter logs de automação"""
        # Criar automação
        create_response = client.post(
            "/automations/",
            json={
                "name": "Logs Test",
                "trigger_type": "contact_created",
                "actions": [],
            },
            headers=auth_headers,
        )
        automation_id = create_response.json()["id"]

        # Obter logs
        response = client.get(
            f"/automations/{automation_id}/logs",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)

    def test_unauthorized_automations(self, client):
        """Sem autenticação, não pode acessar automações"""
        response = client.get("/automations/")
        assert response.status_code == 401

    def test_automation_pagination(self, client, auth_headers):
        """Listar automações com paginação"""
        response = client.get(
            "/automations/?limit=10&offset=0",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["limit"] == 10
        assert data["offset"] == 0

    def test_automation_with_conditions(self, client, auth_headers):
        """Criar automação com condições de trigger"""
        automation_data = {
            "name": "Contato do Gmail",
            "trigger_type": "contact_created",
            "trigger_conditions": {
                "field": "email",
                "operator": "contains",
                "value": "@gmail.com"
            },
            "actions": [],
        }

        response = client.post(
            "/automations/",
            json=automation_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        assert data["trigger_conditions"]["value"] == "@gmail.com"
