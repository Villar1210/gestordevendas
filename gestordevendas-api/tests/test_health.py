"""
Testes básicos: health check e root.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["service"] == "gestordevendas-api"
    assert "version" in body


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert "name" in body
    assert "version" in body


def test_internal_ping():
    response = client.get("/api/ping")
    assert response.status_code == 200
    assert response.json()["router"] == "internal"


def test_v1_ping():
    response = client.get("/v1/ping")
    assert response.status_code == 200
    assert response.json()["version"] == "v1"
