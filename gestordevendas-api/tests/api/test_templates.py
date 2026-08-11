"""
Testes para Message Templates API (síncronos).
Validação de CRUD e operações.
"""
import pytest
from uuid import uuid4


class TestMessageTemplates:
    """Testes de Message Templates."""

    def test_create_template(self, client, auth_headers):
        """Criar novo template."""
        response = client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Greeting Template",
                "content": "Olá {{name}}, bem-vindo!",
                "category": "greeting",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Greeting Template"
        assert data["category"] == "greeting"
        assert data["content"] == "Olá {{name}}, bem-vindo!"
        assert data["usage_count"] == 0
        assert data["is_active"] is True

    def test_list_templates(self, client, auth_headers):
        """Listar templates."""
        # Criar 2 templates
        client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Template 1",
                "content": "Conteúdo 1 com 15 caracteres",
                "category": "general",
            },
        )
        client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Template 2",
                "content": "Conteúdo 2 com 15 caracteres",
                "category": "greeting",
            },
        )

        # Listar todos
        response = client.get("/api/templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    def test_list_templates_by_category(self, client, auth_headers):
        """Listar templates por categoria."""
        # Criar 2 templates com categorias diferentes
        client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Greeting",
                "content": "Olá com 10 caracteres",
                "category": "greeting",
            },
        )
        client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Closing",
                "content": "Até logo com mais de dez chars",
                "category": "closing",
            },
        )

        # Filtrar por categoria
        response = client.get(
            "/api/templates?category=greeting",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert all(t["category"] == "greeting" for t in data)

    def test_get_template(self, client, auth_headers):
        """Buscar template específico."""
        # Criar template
        create_response = client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Test Template",
                "content": "Test content with 20 chars minimum",
                "category": "general",
            },
        )
        template_id = create_response.json()["id"]

        # Buscar
        response = client.get(
            f"/api/templates/{template_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == template_id
        assert data["name"] == "Test Template"

    def test_get_template_not_found(self, client, auth_headers):
        """Template não encontrado."""
        fake_id = uuid4()
        response = client.get(
            f"/api/templates/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_template(self, client, auth_headers):
        """Atualizar template."""
        # Criar
        create_response = client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Original",
                "content": "Original content with minimum required length",
                "category": "general",
            },
        )
        template_id = create_response.json()["id"]

        # Atualizar
        response = client.patch(
            f"/api/templates/{template_id}",
            headers=auth_headers,
            json={"content": "Updated content with minimum required length", "category": "support"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Updated content with minimum required length"
        assert data["category"] == "support"
        assert data["name"] == "Original"  # Nome não mudou

    def test_delete_template(self, client, auth_headers):
        """Deletar template."""
        # Criar
        create_response = client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "To Delete",
                "content": "Delete me with minimum 10 characters here",
                "category": "general",
            },
        )
        template_id = create_response.json()["id"]

        # Deletar
        response = client.delete(
            f"/api/templates/{template_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Confirmar que foi deletado
        response = client.get(
            f"/api/templates/{template_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_apply_template_with_variables(self, client, auth_headers):
        """Aplicar template com variáveis."""
        # Criar template com variáveis
        create_response = client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Personalized",
                "content": "Olá {{name}}, bem-vindo à {{company}}!",
                "category": "greeting",
            },
        )
        template_id = create_response.json()["id"]

        # Aplicar com variáveis
        response = client.post(
            f"/api/templates/{template_id}/apply",
            headers=auth_headers,
            json={"variables": {"name": "João", "company": "Acme"}},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Olá João, bem-vindo à Acme!"
        # Verificar que usage_count foi incrementado
        assert data["usage_count"] == 1

    def test_template_validation(self, client, auth_headers):
        """Validação de campos obrigatórios."""
        # Sem name
        response = client.post(
            "/api/templates",
            headers=auth_headers,
            json={"content": "Content only with minimum chars"},
        )
        assert response.status_code == 422

        # Conteúdo muito curto
        response = client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Short",
                "content": "Hi",  # < 10 caracteres
            },
        )
        assert response.status_code == 422

        # Categoria inválida
        response = client.post(
            "/api/templates",
            headers=auth_headers,
            json={
                "name": "Invalid",
                "content": "Valid content here with minimum required length",
                "category": "invalid_category",
            },
        )
        assert response.status_code == 422

    def test_unauthorized_access(self, client):
        """Sem autenticação, deve retornar 401."""
        response = client.get("/api/templates")
        assert response.status_code == 401

        response = client.post(
            "/api/templates",
            json={
                "name": "Template",
                "content": "Content with at least 10 characters",
            },
        )
        assert response.status_code == 401
