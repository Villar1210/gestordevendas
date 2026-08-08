"""
Testes de integração — Conversations + Messages.
"""
import pytest
import httpx


@pytest.fixture
def inbox_and_contact(client: httpx.Client):
    """Cria inbox e contato de teste, remove ao final."""
    contact = client.post("/api/contacts", json={"name": "Conv Test", "phone": "5511933333333"}).json()
    yield {"contact": contact}
    client.delete(f"/api/contacts/{contact['id']}")


class TestConversations:
    def test_list_conversations(self, client: httpx.Client):
        resp = client.get("/api/conversations")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_conversations_filter_by_status(self, client: httpx.Client):
        for status in ("open", "resolved", "pending"):
            resp = client.get("/api/conversations", params={"status": status})
            assert resp.status_code == 200
            for c in resp.json():
                assert c["status"] == status

    def test_assign_nonexistent_conversation(self, client: httpx.Client):
        resp = client.patch(
            "/api/conversations/00000000-0000-0000-0000-000000000000/assign",
            json={"assignee_id": "00000000-0000-0000-0000-000000000001"},
        )
        assert resp.status_code == 404

    def test_messages_empty_conversation(self, client: httpx.Client):
        """Mensagens de uma conversa inexistente retornam 404."""
        resp = client.get("/api/conversations/00000000-0000-0000-0000-000000000000/messages")
        assert resp.status_code == 404


class TestMessages:
    def test_send_message_to_open_conversation(self, client: httpx.Client):
        """Se existir pelo menos uma conversa aberta, testa envio de mensagem."""
        convs = client.get("/api/conversations", params={"status": "open"}).json()
        if not convs:
            pytest.skip("Nenhuma conversa aberta disponível para teste")

        conv_id = convs[0]["id"]
        resp = client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Mensagem de teste de integração", "message_type": "text"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["direction"] == "outbound"
        assert data["content"] == "Mensagem de teste de integração"
