"""Testes para WhatsApp Integration (Task 1, Fase 4)"""
import pytest


class TestWhatsAppIntegration:
    """Testes de WhatsApp"""

    def test_setup_integration(self, client, auth_headers):
        """Configurar integração"""
        setup_data = {
            "business_account_id": "123456789",
            "phone_number_id": "987654321",
            "access_token": "test_token",
            "phone_number": "+5511999999999",
            "webhook_secret": "test_secret",
        }

        response = client.post(
            "/whatsapp/setup",
            json=setup_data,
            headers=auth_headers,
        )
        # Esperamos erro porque o token é inválido
        assert response.status_code in [400, 401]

    def test_get_config(self, client, auth_headers):
        """Obter configuração"""
        response = client.get("/whatsapp/config", headers=auth_headers)
        # Esperamos 404 porque não há integração configurada
        assert response.status_code == 404

    def test_send_message_no_config(self, client, auth_headers):
        """Enviar mensagem sem configuração"""
        message_data = {
            "phone_number": "+5511999999999",
            "message_type": "text",
            "content": "Olá",
        }

        response = client.post(
            "/whatsapp/send",
            json=message_data,
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_get_messages(self, client, auth_headers):
        """Obter mensagens"""
        response = client.get("/whatsapp/messages", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "messages" in data
        assert "total" in data

    def test_get_contacts(self, client, auth_headers):
        """Obter contatos"""
        response = client.get("/whatsapp/contacts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "contacts" in data
        assert "total" in data

    def test_unauthorized_whatsapp(self, client):
        """Sem autenticação"""
        response = client.get("/whatsapp/config")
        assert response.status_code == 401
