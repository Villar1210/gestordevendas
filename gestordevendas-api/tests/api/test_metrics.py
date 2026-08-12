"""Testes para Metrics Endpoints (Task 4)"""
import pytest
from datetime import date, timedelta


class TestMetrics:
    """Testes de endpoints de métricas"""

    def test_get_kpis(self, client, auth_headers):
        """Obter KPIs para um período"""
        start_date = date.today() - timedelta(days=30)
        end_date = date.today()

        response = client.get(
            f"/metrics/kpi?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "kpis" in data
        assert "period_start" in data
        assert "period_end" in data

    def test_get_kpis_invalid_dates(self, client, auth_headers):
        """KPIs com datas inválidas"""
        start_date = date.today()
        end_date = date.today() - timedelta(days=30)  # End antes de start

        response = client.get(
            f"/metrics/kpi?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_get_trends(self, client, auth_headers):
        """Obter tendências para evento"""
        start_date = date.today() - timedelta(days=30)
        end_date = date.today()

        response = client.get(
            f"/metrics/trends/card_created?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "metric_name" in data
        assert "trends" in data
        assert data["metric_name"] == "card_created"

    def test_get_trends_invalid_event_type(self, client, auth_headers):
        """Tendências com tipo de evento vazio"""
        start_date = date.today() - timedelta(days=30)
        end_date = date.today()

        response = client.get(
            f"/metrics/trends/?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )
        assert response.status_code in [404, 422]  # Falta param ou 404

    def test_get_team_metrics(self, client, auth_headers):
        """Obter métricas da equipe"""
        start_date = date.today() - timedelta(days=30)
        end_date = date.today()

        response = client.get(
            f"/metrics/team?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "team_members" in data
        assert "team_summary" in data
        assert "period_start" in data
        assert "period_end" in data

    def test_get_team_metrics_invalid_dates(self, client, auth_headers):
        """Team metrics com datas inválidas"""
        start_date = date.today()
        end_date = date.today() - timedelta(days=30)

        response = client.get(
            f"/metrics/team?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_unauthorized_kpis(self, client):
        """Sem autenticação, não pode obter KPIs"""
        start_date = date.today() - timedelta(days=30)
        end_date = date.today()

        response = client.get(
            f"/metrics/kpi?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 401

    def test_unauthorized_trends(self, client):
        """Sem autenticação, não pode obter tendências"""
        start_date = date.today() - timedelta(days=30)
        end_date = date.today()

        response = client.get(
            f"/metrics/trends/card_created?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 401

    def test_unauthorized_team_metrics(self, client):
        """Sem autenticação, não pode obter team metrics"""
        start_date = date.today() - timedelta(days=30)
        end_date = date.today()

        response = client.get(
            f"/metrics/team?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 401

    def test_kpis_response_structure(self, client, auth_headers):
        """Estrutura de resposta de KPIs"""
        start_date = date.today() - timedelta(days=7)
        end_date = date.today()

        response = client.get(
            f"/metrics/kpi?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Verificar estrutura obrigatória
        assert isinstance(data["kpis"], list)
        assert isinstance(data["summary"], dict)
        assert "period_start" in data
        assert "period_end" in data

    def test_trends_response_structure(self, client, auth_headers):
        """Estrutura de resposta de tendências"""
        start_date = date.today() - timedelta(days=7)
        end_date = date.today()

        response = client.get(
            f"/metrics/trends/card_won?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Verificar estrutura obrigatória
        assert isinstance(data["trends"], list)
        assert isinstance(data["summary"], dict)
        assert data["metric_name"] == "card_won"
