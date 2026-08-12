"""Testes para Stripe Integration (Task 4, Fase 5)"""
import pytest
import json
from unittest.mock import Mock, patch, AsyncMock


class TestStripeIntegration:
    """Testes de integração com Stripe"""

    def test_list_plans_unauth(self, client):
        """Listar planos não requer autenticação"""
        response = client.get("/billing/plans")
        assert response.status_code == 200
        data = response.json()

        assert "plans" in data
        assert len(data["plans"]) == 3

    def test_free_plan_zero_price(self, client):
        """Plano gratuito tem preço 0"""
        response = client.get("/billing/plans")
        plans = response.json()["plans"]
        free_plan = [p for p in plans if p["id"] == "free"][0]

        assert free_plan["price"] == 0

    def test_setup_billing_auth_required(self, client):
        """Setup requer autenticação"""
        response = client.post(
            "/billing/setup",
            json={
                "billing_email": "test@example.com",
                "billing_name": "Test Company",
            },
        )
        assert response.status_code == 401

    @patch("app.infra.stripe.stripe_service.stripe.Customer.create")
    def test_setup_billing_success(self, mock_stripe_customer, client, auth_headers):
        """Configurar faturamento com sucesso"""
        mock_stripe_customer.return_value = Mock(
            id="cus_test123",
            email="test@example.com",
            name="Test Company",
        )

        response = client.post(
            "/billing/setup",
            json={
                "billing_email": "test@example.com",
                "billing_name": "Test Company",
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["stripe_customer_id"] == "cus_test123"
        assert data["billing_email"] == "test@example.com"

    def test_subscribe_free_plan(self, client, auth_headers):
        """Inscrever no plano gratuito"""
        response = client.post(
            "/billing/subscribe?plan_id=free",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True

    def test_subscribe_without_customer(self, client, auth_headers):
        """Inscrever sem cliente configurado falha"""
        response = client.post(
            "/billing/subscribe?plan_id=starter",
            headers=auth_headers,
        )

        # Deve retornar 404 porque cliente não existe
        # (No banco, o repositório vai retornar None)
        assert response.status_code == 404

    def test_subscribe_invalid_plan(self, client, auth_headers):
        """Plano inválido"""
        response = client.post(
            "/billing/subscribe?plan_id=invalid",
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_webhook_invalid_signature(self, client):
        """Webhook com assinatura inválida"""
        response = client.post(
            "/billing/webhook",
            data="{}",
            headers={"stripe-signature": "invalid"},
        )

        # Stripe vai validar e rejeitar
        assert response.status_code == 400

    def test_webhook_missing_signature(self, client):
        """Webhook sem assinatura"""
        response = client.post(
            "/billing/webhook",
            json={},
        )

        assert response.status_code == 400
        data = response.json()

        assert "assinatura" in data["detail"].lower()

    def test_unauthorized_get_customer(self, client):
        """Get customer requer autenticação"""
        response = client.get("/billing/customer")
        assert response.status_code == 401

    def test_unauthorized_get_subscription(self, client):
        """Get subscription requer autenticação"""
        response = client.get("/billing/subscription")
        assert response.status_code == 401

    def test_unauthorized_list_invoices(self, client):
        """List invoices requer autenticação"""
        response = client.get("/billing/invoices")
        assert response.status_code == 401

    def test_unauthorized_open_portal(self, client):
        """Open portal requer autenticação"""
        response = client.post("/billing/portal")
        assert response.status_code == 401


class TestStripeService:
    """Testes unitários do StripeService"""

    @patch("app.infra.stripe.stripe_service.stripe.Customer.create")
    def test_create_customer(self, mock_create):
        """Criar cliente Stripe"""
        from app.infra.stripe import StripeService

        mock_create.return_value = Mock(
            id="cus_123",
            email="test@example.com",
            name="Test",
        )

        result = StripeService.create_customer(
            email="test@example.com",
            name="Test",
            account_id="acc_1",
        )

        assert result["stripe_customer_id"] == "cus_123"
        assert result["email"] == "test@example.com"

    @patch("app.infra.stripe.stripe_service.stripe.Webhook.construct_event")
    def test_verify_webhook_signature(self, mock_construct):
        """Validar assinatura do webhook"""
        from app.infra.stripe import StripeService

        mock_construct.return_value = {
            "type": "customer.subscription.updated",
            "data": {"object": {}},
        }

        event = StripeService.verify_webhook_signature(
            b"body", "sig_test"
        )

        assert event["type"] == "customer.subscription.updated"

    @patch("app.infra.stripe.stripe_service.stripe.Webhook.construct_event")
    def test_verify_webhook_invalid_signature(self, mock_construct):
        """Validar assinatura inválida"""
        from app.infra.stripe import StripeService
        import stripe

        mock_construct.side_effect = stripe.error.SignatureVerificationError(
            "sig", "body"
        )

        with pytest.raises(ValueError, match="Invalid webhook signature"):
            StripeService.verify_webhook_signature(b"body", "sig_invalid")

    def test_handle_webhook_subscription_updated(self):
        """Processar webhook de subscrição atualizada"""
        from app.infra.stripe import StripeService

        event = {
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_123",
                    "status": "active",
                }
            },
        }

        result = StripeService.handle_webhook_event(event)

        assert result["type"] == "subscription_updated"
        assert result["subscription_id"] == "sub_123"
        assert result["status"] == "active"

    def test_handle_webhook_invoice_paid(self):
        """Processar webhook de fatura paga"""
        from app.infra.stripe import StripeService

        event = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "id": "inv_123",
                    "customer": "cus_123",
                    "amount_paid": 9900,
                }
            },
        }

        result = StripeService.handle_webhook_event(event)

        assert result["type"] == "invoice_paid"
        assert result["invoice_id"] == "inv_123"
        assert result["amount"] == 9900

    def test_handle_webhook_unhandled_event(self):
        """Processar webhook não tratado"""
        from app.infra.stripe import StripeService

        event = {
            "type": "charge.succeeded",
            "data": {"object": {}},
        }

        result = StripeService.handle_webhook_event(event)

        assert result["type"] == "unhandled"
        assert result["event_type"] == "charge.succeeded"
