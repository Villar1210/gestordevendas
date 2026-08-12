"""Testes para Knowledge Base Vector Search (Task 3)"""
import pytest
from uuid import uuid4


class TestKnowledgeSearch:
    """Testes de busca vetorial de conhecimento"""

    def test_create_knowledge_document(self, client, auth_headers):
        """Criar novo documento de conhecimento"""
        response = client.post(
            "/knowledge",
            headers=auth_headers,
            json={
                "title": "Python Basics",
                "content": "Python is a high-level programming language with simple syntax",
                "category": "tutorial",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Python Basics"
        assert data["category"] == "tutorial"

    def test_create_knowledge_missing_title(self, client, auth_headers):
        """Criar documento sem título"""
        response = client.post(
            "/knowledge",
            headers=auth_headers,
            json={
                "content": "Python is a high-level programming language with simple syntax",
            },
        )
        assert response.status_code == 422

    def test_create_knowledge_short_content(self, client, auth_headers):
        """Conteúdo muito curto (< 10 chars)"""
        response = client.post(
            "/knowledge",
            headers=auth_headers,
            json={
                "title": "Short",
                "content": "Too short",  # Apenas 9 caracteres
            },
        )
        assert response.status_code == 422

    def test_get_knowledge_document(self, client, auth_headers):
        """Obter documento de conhecimento"""
        knowledge_id = str(uuid4())
        response = client.get(
            f"/knowledge/{knowledge_id}",
            headers=auth_headers,
        )
        # Esperado: falha porque documento não existe
        assert response.status_code in [404, 500]

    def test_search_knowledge_base(self, client, auth_headers):
        """Buscar na base de conhecimento"""
        response = client.post(
            "/knowledge/search",
            headers=auth_headers,
            json={
                "query": "How to use Python",
                "limit": 5,
                "threshold": 0.5,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "query" in data
        assert "results" in data
        assert "total" in data
        assert data["query"] == "How to use Python"

    def test_search_with_invalid_limit(self, client, auth_headers):
        """Buscar com limite inválido (> 20)"""
        response = client.post(
            "/knowledge/search",
            headers=auth_headers,
            json={
                "query": "Python",
                "limit": 50,  # Máximo é 20
                "threshold": 0.5,
            },
        )
        assert response.status_code == 422

    def test_search_with_invalid_threshold(self, client, auth_headers):
        """Buscar com threshold inválido (< 0)"""
        response = client.post(
            "/knowledge/search",
            headers=auth_headers,
            json={
                "query": "Python",
                "limit": 5,
                "threshold": -0.1,  # Deve ser 0-1
            },
        )
        assert response.status_code == 422

    def test_search_with_short_query(self, client, auth_headers):
        """Buscar com query muito curta (< 3 chars)"""
        response = client.post(
            "/knowledge/search",
            headers=auth_headers,
            json={
                "query": "py",  # Apenas 2 caracteres
                "limit": 5,
                "threshold": 0.5,
            },
        )
        assert response.status_code == 422

    def test_unauthorized_create_knowledge(self, client):
        """Sem autenticação, não pode criar"""
        response = client.post(
            "/knowledge",
            json={
                "title": "Test",
                "content": "This is a test document for knowledge base",
            },
        )
        assert response.status_code == 401

    def test_unauthorized_search_knowledge(self, client):
        """Sem autenticação, não pode buscar"""
        response = client.post(
            "/knowledge/search",
            json={
                "query": "Python",
                "limit": 5,
                "threshold": 0.5,
            },
        )
        assert response.status_code == 401

    def test_create_knowledge_with_all_fields(self, client, auth_headers):
        """Criar documento com todos os campos"""
        response = client.post(
            "/knowledge",
            headers=auth_headers,
            json={
                "title": "Complete Guide to FastAPI",
                "content": "FastAPI is a modern web framework for building APIs with Python",
                "category": "documentation",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Complete Guide to FastAPI"
        assert data["content"] == "FastAPI is a modern web framework for building APIs with Python"
        assert data["category"] == "documentation"
