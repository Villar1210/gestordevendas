"""Use cases para Webhooks Module (Task 1, Fase 3)"""
import httpx
import hmac
import hashlib
import json
import time
from typing import List, Optional
from datetime import datetime, timedelta
from app.api.internal.webhooks_schemas import (
    WebhookCreate,
    WebhookUpdate,
    WebhookResponse,
    WebhookLogResponse,
    WebhookTestRequest,
    WebhookTestResponse,
)


class CreateWebhookUseCase:
    """Criar novo webhook"""

    def __init__(self, webhooks_repository):
        self.webhooks_repository = webhooks_repository

    async def execute(
        self,
        account_id: str,
        webhook_data: WebhookCreate,
    ) -> WebhookResponse:
        """Criar webhook"""
        webhook = await self.webhooks_repository.create_webhook(
            account_id=account_id,
            name=webhook_data.name,
            url=str(webhook_data.url),
            events=webhook_data.events,
            description=webhook_data.description,
            retry_count=webhook_data.retry_count,
            timeout_seconds=webhook_data.timeout_seconds,
        )

        return WebhookResponse(**webhook)


class ListWebhooksUseCase:
    """Listar webhooks"""

    def __init__(self, webhooks_repository):
        self.webhooks_repository = webhooks_repository

    async def execute(
        self,
        account_id: str,
        active_only: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        """Listar webhooks do tenant"""
        webhooks, total = await self.webhooks_repository.get_webhooks(
            account_id=account_id,
            active_only=active_only,
            limit=limit,
            offset=offset,
        )

        return {
            "webhooks": [WebhookResponse(**w) for w in webhooks],
            "total": total,
            "limit": limit,
            "offset": offset,
        }


class GetWebhookUseCase:
    """Obter webhook específico"""

    def __init__(self, webhooks_repository):
        self.webhooks_repository = webhooks_repository

    async def execute(self, webhook_id: str, account_id: str) -> WebhookResponse:
        """Obter webhook"""
        webhook = await self.webhooks_repository.get_webhook(webhook_id, account_id)

        if not webhook:
            raise ValueError(f"Webhook {webhook_id} não encontrado")

        return WebhookResponse(**webhook)


class UpdateWebhookUseCase:
    """Atualizar webhook"""

    def __init__(self, webhooks_repository):
        self.webhooks_repository = webhooks_repository

    async def execute(
        self,
        webhook_id: str,
        account_id: str,
        webhook_data: WebhookUpdate,
    ) -> WebhookResponse:
        """Atualizar webhook"""
        # Preparar dados para update (apenas campos não-nulos)
        update_data = webhook_data.model_dump(exclude_none=True)

        webhook = await self.webhooks_repository.update_webhook(
            webhook_id=webhook_id,
            account_id=account_id,
            **update_data,
        )

        if not webhook:
            raise ValueError(f"Webhook {webhook_id} não encontrado")

        return WebhookResponse(**webhook)


class DeleteWebhookUseCase:
    """Deletar webhook"""

    def __init__(self, webhooks_repository):
        self.webhooks_repository = webhooks_repository

    async def execute(self, webhook_id: str, account_id: str) -> bool:
        """Deletar webhook"""
        success = await self.webhooks_repository.delete_webhook(
            webhook_id, account_id
        )

        if not success:
            raise ValueError(f"Webhook {webhook_id} não encontrado")

        return True


class GetWebhookLogsUseCase:
    """Obter logs de webhook"""

    def __init__(self, webhooks_repository):
        self.webhooks_repository = webhooks_repository

    async def execute(
        self,
        webhook_id: str,
        account_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Obter logs"""
        # Verificar que webhook pertence ao tenant
        webhook = await self.webhooks_repository.get_webhook(webhook_id, account_id)
        if not webhook:
            raise ValueError(f"Webhook {webhook_id} não encontrado")

        logs, total = await self.webhooks_repository.get_webhook_logs(
            webhook_id=webhook_id,
            limit=limit,
            offset=offset,
        )

        return {
            "logs": [WebhookLogResponse(**log) for log in logs],
            "total": total,
            "limit": limit,
            "offset": offset,
        }


class TriggerWebhookUseCase:
    """Disparar webhook para um evento"""

    def __init__(self, webhooks_repository):
        self.webhooks_repository = webhooks_repository

    async def execute(
        self,
        account_id: str,
        event_type: str,
        event_data: dict,
    ) -> List[dict]:
        """Disparar webhooks para um evento"""
        # Buscar webhooks ativados para este evento
        webhooks = await self.webhooks_repository.get_webhooks_by_event(
            account_id, event_type
        )

        results = []

        for webhook in webhooks:
            # Disparar webhook em background (idealmente via Celery)
            result = await self._trigger_webhook(webhook, event_type, event_data)
            results.append(result)

        return results

    async def _trigger_webhook(
        self,
        webhook: dict,
        event_type: str,
        event_data: dict,
    ) -> dict:
        """Disparar webhook individual com retry"""
        webhook_id = webhook["id"]
        url = webhook["url"]
        secret = webhook["secret"]
        retry_count = webhook["retry_count"]
        timeout = webhook["timeout_seconds"]

        payload = {
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": event_data,
        }

        for attempt in range(1, retry_count + 1):
            try:
                # Calcular HMAC signature
                signature = self._calculate_signature(secret, json.dumps(payload))

                # Fazer requisição
                async with httpx.AsyncClient() as client:
                    start_time = time.time()

                    response = await client.post(
                        url,
                        json=payload,
                        headers={
                            "X-Webhook-Signature": signature,
                            "X-Webhook-Event": event_type,
                            "User-Agent": "GestordeVendas/1.0",
                        },
                        timeout=timeout,
                    )

                    elapsed_ms = int((time.time() - start_time) * 1000)

                    # Log sucesso
                    await self.webhooks_repository.create_webhook_log(
                        webhook_id=webhook_id,
                        event_type=event_type,
                        payload=payload,
                        status_code=response.status_code,
                        response_body=response.text[:500],
                        status="success" if response.status_code < 300 else "failed",
                        attempt_number=attempt,
                    )

                    # Atualizar último disparo
                    await self.webhooks_repository.update_last_triggered(webhook_id)

                    return {
                        "webhook_id": webhook_id,
                        "success": response.status_code < 300,
                        "status_code": response.status_code,
                        "response_time_ms": elapsed_ms,
                        "attempt": attempt,
                    }

            except httpx.TimeoutException:
                error_msg = "Request timeout"
                await self.webhooks_repository.create_webhook_log(
                    webhook_id=webhook_id,
                    event_type=event_type,
                    payload=payload,
                    status="timeout",
                    error_message=error_msg,
                    attempt_number=attempt,
                )

                if attempt < retry_count:
                    # Agendar retry
                    next_retry = datetime.utcnow() + timedelta(
                        seconds=30 * attempt
                    )

            except Exception as e:
                error_msg = str(e)
                await self.webhooks_repository.create_webhook_log(
                    webhook_id=webhook_id,
                    event_type=event_type,
                    payload=payload,
                    status="failed",
                    error_message=error_msg,
                    attempt_number=attempt,
                )

                if attempt >= retry_count:
                    break

        return {
            "webhook_id": webhook_id,
            "success": False,
            "error": "Max retries exceeded",
        }

    def _calculate_signature(self, secret: str, payload: str) -> str:
        """Calcular HMAC-SHA256 signature"""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()


class TestWebhookUseCase:
    """Testar webhook"""

    def __init__(self, webhooks_repository):
        self.webhooks_repository = webhooks_repository
        self.trigger_use_case = TriggerWebhookUseCase(webhooks_repository)

    async def execute(
        self,
        webhook_id: str,
        account_id: str,
        test_data: WebhookTestRequest,
    ) -> WebhookTestResponse:
        """Testar webhook"""
        # Verificar que webhook pertence ao tenant
        webhook = await self.webhooks_repository.get_webhook(webhook_id, account_id)
        if not webhook:
            raise ValueError(f"Webhook {webhook_id} não encontrado")

        try:
            result = await self.trigger_use_case._trigger_webhook(
                webhook,
                test_data.event_type,
                test_data.test_payload,
            )

            return WebhookTestResponse(
                success=result.get("success", False),
                status_code=result.get("status_code"),
                response_time_ms=result.get("response_time_ms", 0),
                error_message=result.get("error"),
            )

        except Exception as e:
            return WebhookTestResponse(
                success=False,
                response_time_ms=0,
                error_message=str(e),
            )
