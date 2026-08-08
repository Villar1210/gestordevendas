"""
Testes de integração — Contacts CRUD.
"""
import pytest
import httpx


@pytest.fixture
def created_contact(client: httpx.Client):
    """Cria um contato de teste e remove ao final."""
    phone = "5511900000000"
    resp = client.post("/api/contacts", json={"name": "Teste Int", "phone": phone, "email": "int@test.com"})
    assert resp.status_code == 201, resp.text
    contact = resp.json()
    yield contact
    # Cleanup
    client.delete(f"/api/contacts/{contact['id']}")


class TestContactsCRUD:
    def test_list_contacts(self, client: httpx.Client):
        resp = client.get("/api/contacts")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_contact(self, client: httpx.Client):
        phone = "5511911111111"
        resp = client.post("/api/contacts", json={"name": "João Teste", "phone": phone})
        assert resp.status_code == 201
        data = resp.json()
        assert data["phone"] == phone
        assert data["name"] == "João Teste"
        # Cleanup
        client.delete(f"/api/contacts/{data['id']}")

    def test_create_duplicate_phone_fails(self, client: httpx.Client, created_contact: dict):
        resp = client.post("/api/contacts", json={
            "name": "Duplicado",
            "phone": created_contact["phone"],
        })
        # Deve retornar 409 ou 422 (telefone único por conta)
        assert resp.status_code in (409, 422), resp.text

    def test_get_contact(self, client: httpx.Client, created_contact: dict):
        resp = client.get(f"/api/contacts/{created_contact['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == created_contact["id"]

    def test_update_contact(self, client: httpx.Client, created_contact: dict):
        resp = client.patch(
            f"/api/contacts/{created_contact['id']}",
            json={"name": "Nome Atualizado", "tags": ["vip"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Nome Atualizado"
        assert "vip" in data["tags"]

    def test_search_contact(self, client: httpx.Client, created_contact: dict):
        resp = client.get("/api/contacts", params={"search": "Teste Int"})
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()]
        assert created_contact["id"] in ids

    def test_delete_contact(self, client: httpx.Client):
        phone = "5511922222222"
        create_resp = client.post("/api/contacts", json={"name": "Para Deletar", "phone": phone})
        assert create_resp.status_code == 201
        contact_id = create_resp.json()["id"]

        del_resp = client.delete(f"/api/contacts/{contact_id}")
        assert del_resp.status_code in (200, 204)

        get_resp = client.get(f"/api/contacts/{contact_id}")
        assert get_resp.status_code == 404

    def test_get_nonexistent_returns_404(self, client: httpx.Client):
        resp = client.get("/api/contacts/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404
