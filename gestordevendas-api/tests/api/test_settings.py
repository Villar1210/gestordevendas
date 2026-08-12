"""Testes para Settings Module (Task 5)"""
import pytest


class TestSettings:
    """Testes de endpoints de configurações"""

    def test_get_settings_creates_default(self, client, auth_headers):
        """Obter settings cria padrão se não existir"""
        response = client.get("/settings/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Verificar estrutura básica
        assert "id" in data
        assert "account_id" in data
        assert "general" in data
        assert "features" in data
        assert "quota" in data
        assert "notifications" in data
        assert "security" in data

    def test_get_settings_general_defaults(self, client, auth_headers):
        """Configurações gerais retornam valores padrão"""
        response = client.get("/settings/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        general = data["general"]
        assert general["theme"] == "light"
        assert general["language"] == "pt-BR"
        assert general["timezone"] == "America/Sao_Paulo"

    def test_get_settings_feature_flags_defaults(self, client, auth_headers):
        """Feature flags retornam valores padrão"""
        response = client.get("/settings/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        features = data["features"]
        assert features["enable_whatsapp"] == True
        assert features["enable_email"] == True
        assert features["enable_sms"] == False
        assert features["enable_analytics"] == True
        assert features["enable_ai"] == False

    def test_get_settings_quota_defaults(self, client, auth_headers):
        """Quotas retornam valores padrão"""
        response = client.get("/settings/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        quota = data["quota"]
        assert quota["max_users"] == 10
        assert quota["max_contacts"] == 1000
        assert quota["max_storage_gb"] == 5

    def test_get_settings_security_defaults(self, client, auth_headers):
        """Configurações de segurança retornam valores padrão"""
        response = client.get("/settings/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        security = data["security"]
        assert security["require_2fa"] == False
        assert security["api_key_rotation_days"] == 90
        assert security["session_timeout_minutes"] == 60

    def test_update_general_settings(self, client, auth_headers):
        """Atualizar configurações gerais"""
        update_data = {
            "general": {
                "company_name": "Test Company",
                "theme": "dark",
                "language": "en-US",
                "timezone": "America/New_York",
            }
        }
        response = client.patch("/settings/", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        general = data["general"]
        assert general["company_name"] == "Test Company"
        assert general["theme"] == "dark"
        assert general["language"] == "en-US"
        assert general["timezone"] == "America/New_York"

    def test_update_feature_flags(self, client, auth_headers):
        """Atualizar feature flags"""
        update_data = {"features": {"enable_sms": True, "enable_ai": True}}
        response = client.patch("/settings/", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        features = data["features"]
        assert features["enable_sms"] == True
        assert features["enable_ai"] == True

    def test_update_quota_settings(self, client, auth_headers):
        """Atualizar quotas"""
        update_data = {"quota": {"max_users": 50, "max_contacts": 5000}}
        response = client.patch("/settings/", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        quota = data["quota"]
        assert quota["max_users"] == 50
        assert quota["max_contacts"] == 5000

    def test_update_security_settings(self, client, auth_headers):
        """Atualizar configurações de segurança"""
        update_data = {"security": {"require_2fa": True, "api_key_rotation_days": 30}}
        response = client.patch("/settings/", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        security = data["security"]
        assert security["require_2fa"] == True
        assert security["api_key_rotation_days"] == 30

    def test_partial_update(self, client, auth_headers):
        """Atualização parcial não afeta outras configurações"""
        # Primeiro, pega as settings atuais
        response = client.get("/settings/", headers=auth_headers)
        assert response.status_code == 200
        original = response.json()

        # Atualiza só a empresa
        update_data = {"general": {"company_name": "New Name"}}
        response = client.patch("/settings/", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        updated = response.json()

        # Verifica que features não mudaram
        assert (
            updated["features"]["enable_whatsapp"]
            == original["features"]["enable_whatsapp"]
        )
        assert updated["general"]["company_name"] == "New Name"

    def test_unauthorized_get_settings(self, client):
        """Sem autenticação, não pode obter settings"""
        response = client.get("/settings/")
        assert response.status_code == 401

    def test_unauthorized_update_settings(self, client):
        """Sem autenticação, não pode atualizar settings"""
        update_data = {"general": {"company_name": "Hacked"}}
        response = client.patch("/settings/", json=update_data)
        assert response.status_code == 401

    def test_multiple_updates_cumulative(self, client, auth_headers):
        """Múltiplas atualizações acumulam"""
        # Atualiza geral
        update1 = {"general": {"company_name": "Company A"}}
        response1 = client.patch("/settings/", json=update1, headers=auth_headers)
        assert response1.status_code == 200

        # Atualiza features
        update2 = {"features": {"enable_sms": True}}
        response2 = client.patch("/settings/", json=update2, headers=auth_headers)
        assert response2.status_code == 200
        data = response2.json()

        # Ambas mudanças devem estar presentes
        assert data["general"]["company_name"] == "Company A"
        assert data["features"]["enable_sms"] == True

    def test_invalid_theme_rejected(self, client, auth_headers):
        """Tema inválido é rejeitado"""
        update_data = {"general": {"theme": "invalid_theme"}}
        response = client.patch("/settings/", json=update_data, headers=auth_headers)
        assert response.status_code in [400, 422]
