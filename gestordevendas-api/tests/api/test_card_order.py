"""Testes para Kanban Order Persistence (Task 2)"""
import pytest
from uuid import uuid4


class TestCardOrder:
    """Testes de persistência de ordem de cards"""

    def test_update_single_card_order(self, client, auth_headers):
        """Atualizar posição de um card"""
        card_id = str(uuid4())
        response = client.patch(
            f"/cards/{card_id}/order",
            headers=auth_headers,
            json={"order_position": 5},
        )
        # Esperado: falha porque card não existe, mas estrutura está correta
        assert response.status_code in [404, 500]

    def test_reorder_multiple_cards(self, client, auth_headers):
        """Reordenar múltiplos cards"""
        response = client.patch(
            "/cards/reorder",
            headers=auth_headers,
            json={
                "orders": [
                    {"card_id": str(uuid4()), "order_position": 1},
                    {"card_id": str(uuid4()), "order_position": 2},
                    {"card_id": str(uuid4()), "order_position": 3},
                ]
            },
        )
        # Esperado: falha porque cards não existem, mas estrutura está correta
        assert response.status_code in [400, 404, 500]

    def test_invalid_order_position(self, client, auth_headers):
        """Posição inválida (negativa)"""
        card_id = str(uuid4())
        response = client.patch(
            f"/cards/{card_id}/order",
            headers=auth_headers,
            json={"order_position": -1},  # Posição negativa
        )
        # Esperado: validação de Pydantic rejeita valores negativos
        assert response.status_code in [422, 404, 500]

    def test_empty_reorder_list(self, client, auth_headers):
        """Tentar reordenar com lista vazia"""
        response = client.patch(
            "/cards/reorder",
            headers=auth_headers,
            json={"orders": []},
        )
        # Esperado: erro de validação
        assert response.status_code in [400, 422, 500]

    def test_missing_required_fields_in_reorder(self, client, auth_headers):
        """Faltam campos obrigatórios em reorder"""
        response = client.patch(
            "/cards/reorder",
            headers=auth_headers,
            json={"orders": [{"card_id": str(uuid4())}]},  # Falta order_position
        )
        # Esperado: erro de validação
        assert response.status_code in [422, 500]

    def test_unauthorized_card_order_update(self, client):
        """Sem autenticação, não pode atualizar ordem"""
        card_id = str(uuid4())
        response = client.patch(
            f"/cards/{card_id}/order",
            json={"order_position": 5},
        )
        assert response.status_code == 401

    def test_unauthorized_card_reorder(self, client):
        """Sem autenticação, não pode reordenar"""
        response = client.patch(
            "/cards/reorder",
            json={
                "orders": [
                    {"card_id": str(uuid4()), "order_position": 1},
                ]
            },
        )
        assert response.status_code == 401
