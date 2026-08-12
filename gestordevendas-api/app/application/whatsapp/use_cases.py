"""Use cases para WhatsApp Integration (Task 1, Fase 4)"""
import httpx
import hmac
import hashlib
import json
from typing import Optional
from app.api.internal.whatsapp_schemas import (
    WhatsAppIntegrationSetup,
    WhatsAppIntegrationResponse,
    WhatsAppMessageSend,
)


class SetupWhatsAppIntegrationUseCase:
    """Configurar integração WhatsApp"""

    def __init__(self, whatsapp_repository):
        self.whatsapp_repository = whatsapp_repository

    async def execute(
        self,
        account_id: str,
        setup_data: WhatsAppIntegrationSetup,
    ) -> WhatsAppIntegrationResponse:
        """Configurar integração"""
        # Validar token com Meta API
        is_valid = await self._validate_token(
            setup_data.access_token,
            setup_data.business_account_id,
        )

        if not is_valid:
            raise ValueError("Token de acesso inválido")

        integration = await self.whatsapp_repository.create_integration(
            account_id=account_id,
            business_account_id=setup_data.business_account_id,
            phone_number_id=setup_data.phone_number_id,
            access_token=setup_data.access_token,
            phone_number=setup_data.phone_number,
            webhook_secret=setup_data.webhook_secret,
        )

        return WhatsAppIntegrationResponse(**integration)

    async def _validate_token(self, token: str, business_id: str) -> bool:
        """Validar token com Meta API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://graph.instagram.com/v21.0/{business_id}",
                    params={"access_token": token},
                    timeout=10,
                )
                return response.status_code == 200
        except Exception:
            return False


class GetIntegrationUseCase:
    """Obter configuração de integração"""

    def __init__(self, whatsapp_repository):
        self.whatsapp_repository = whatsapp_repository

    async def execute(self, account_id: str) -> WhatsAppIntegrationResponse:
        """Obter integração"""
        integration = await self.whatsapp_repository.get_integration(account_id)

        if not integration:
            raise ValueError("Integração WhatsApp não configurada")

        # Remover token da resposta por segurança
        integration.pop("access_token", None)

        return WhatsAppIntegrationResponse(**integration)


class SendMessageUseCase:
    """Enviar mensagem via WhatsApp"""

    def __init__(self, whatsapp_repository):
        self.whatsapp_repository = whatsapp_repository

    async def execute(
        self,
        account_id: str,
        message_data: WhatsAppMessageSend,
    ) -> dict:
        """Enviar mensagem"""
        # Obter integração
        integration = await self.whatsapp_repository.get_integration(account_id)

        if not integration:
            raise ValueError("Integração WhatsApp não configurada")

        # Enviar via Meta API
        message_id = await self._send_via_meta_api(
            integration["phone_number_id"],
            integration["access_token"],
            message_data,
        )

        # Salvar mensagem no banco
        saved_message = await self.whatsapp_repository.save_message(
            account_id=account_id,
            integration_id=integration["id"],
            message_id=message_id,
            phone_number=message_data.phone_number,
            direction="outbound",
            message_type=message_data.message_type,
            content=message_data.content,
            media_url=message_data.media_url,
            status="sent",
        )

        # Atualizar/criar contato
        await self.whatsapp_repository.get_or_create_contact(
            account_id=account_id,
            integration_id=integration["id"],
            phone_number=message_data.phone_number,
        )

        return {
            "success": True,
            "message_id": message_id,
            "phone_number": message_data.phone_number,
        }

    async def _send_via_meta_api(
        self,
        phone_number_id: str,
        access_token: str,
        message_data: WhatsAppMessageSend,
    ) -> str:
        """Enviar mensagem via Meta Cloud API"""
        try:
            async with httpx.AsyncClient() as client:
                # Preparar payload
                payload = {
                    "messaging_product": "whatsapp",
                    "to": message_data.phone_number.replace("+", ""),
                }

                if message_data.message_type == "text":
                    payload["type"] = "text"
                    payload["text"] = {"body": message_data.content}
                elif message_data.message_type in ["image", "document", "audio", "video"]:
                    payload["type"] = message_data.message_type
                    payload[message_data.message_type] = {"link": message_data.media_url}

                response = await client.post(
                    f"https://graph.instagram.com/v21.0/{phone_number_id}/messages",
                    json=payload,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10,
                )

                if response.status_code != 200:
                    raise Exception(f"Meta API error: {response.text}")

                return response.json()["messages"][0]["id"]

        except Exception as e:
            raise Exception(f"Falha ao enviar mensagem: {str(e)}")


class ProcessWebhookUseCase:
    """Processar webhook do WhatsApp"""

    def __init__(self, whatsapp_repository):
        self.whatsapp_repository = whatsapp_repository

    async def execute(
        self,
        account_id: str,
        webhook_payload: dict,
        signature: str,
        secret: str,
    ) -> bool:
        """Processar evento do webhook"""
        # Validar assinatura
        if not self._validate_signature(webhook_payload, signature, secret):
            raise ValueError("Assinatura inválida")

        # Processar eventos de mensagem
        if "entry" in webhook_payload:
            for entry in webhook_payload["entry"]:
                for change in entry.get("changes", []):
                    if change["field"] == "messages":
                        await self._process_message_event(
                            account_id, change["value"]
                        )
                    elif change["field"] == "message_status":
                        await self._process_status_event(
                            account_id, change["value"]
                        )

        return True

    async def _process_message_event(self, account_id: str, data: dict) -> None:
        """Processar evento de mensagem recebida"""
        for message in data.get("messages", []):
            phone_number = data["contacts"][0]["wa_id"]
            contact_name = data["contacts"][0].get("profile", {}).get("name")

            integration = await self.whatsapp_repository.get_integration(account_id)
            if not integration:
                return

            # Extrair conteúdo
            message_type = message["type"]
            content = None
            media_url = None

            if message_type == "text":
                content = message["text"]["body"]
            elif message_type in ["image", "document", "audio", "video"]:
                media_url = message[message_type].get("link")

            # Salvar mensagem
            await self.whatsapp_repository.save_message(
                account_id=account_id,
                integration_id=integration["id"],
                message_id=message["id"],
                phone_number=f"+{phone_number}",
                direction="inbound",
                message_type=message_type,
                content=content,
                media_url=media_url,
            )

            # Atualizar contato
            await self.whatsapp_repository.get_or_create_contact(
                account_id=account_id,
                integration_id=integration["id"],
                phone_number=f"+{phone_number}",
                name=contact_name,
            )

    async def _process_status_event(self, account_id: str, data: dict) -> None:
        """Processar evento de status"""
        for status_event in data.get("statuses", []):
            message_id = status_event["id"]
            status = status_event["status"]  # sent, delivered, read, failed

            await self.whatsapp_repository.update_message_status(
                message_id=message_id,
                status=status,
            )

    def _validate_signature(
        self, payload: dict, signature: str, secret: str
    ) -> bool:
        """Validar assinatura do webhook"""
        try:
            payload_str = json.dumps(payload, separators=(",", ":"), sort_keys=True)
            expected_signature = hmac.new(
                secret.encode(),
                payload_str.encode(),
                hashlib.sha256,
            ).hexdigest()

            return hmac.compare_digest(signature, expected_signature)
        except Exception:
            return False


class GetMessagesUseCase:
    """Obter histórico de mensagens"""

    def __init__(self, whatsapp_repository):
        self.whatsapp_repository = whatsapp_repository

    async def execute(
        self,
        account_id: str,
        phone_number: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Obter mensagens"""
        messages, total = await self.whatsapp_repository.get_messages(
            account_id=account_id,
            phone_number=phone_number,
            limit=limit,
            offset=offset,
        )

        return {
            "messages": messages,
            "total": total,
            "limit": limit,
            "offset": offset,
        }


class GetContactsUseCase:
    """Obter contatos do WhatsApp"""

    def __init__(self, whatsapp_repository):
        self.whatsapp_repository = whatsapp_repository

    async def execute(
        self,
        account_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Obter contatos"""
        contacts, total = await self.whatsapp_repository.get_contacts(
            account_id=account_id,
            limit=limit,
            offset=offset,
        )

        return {
            "contacts": contacts,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
