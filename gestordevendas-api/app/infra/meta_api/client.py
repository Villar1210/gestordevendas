"""
Cliente para a Meta Cloud API (WhatsApp Business).
Referência: https://developers.facebook.com/docs/whatsapp/cloud-api

Regra de segurança:
- O access_token NUNCA é logado, nem retornado ao frontend.
- Toda chamada usa httpx com timeout explícito.
- Erros da API Meta são traduzidos em ExternalServiceError (domínio).
"""
from __future__ import annotations

from typing import Any, Optional

import httpx
import structlog

from app.domain.exceptions import ExternalServiceError

logger = structlog.get_logger(__name__)

META_GRAPH_URL = "https://graph.facebook.com"


class MetaCloudApiClient:
    """
    Cliente HTTP para o Meta Cloud API.
    Instanciado com o phone_number_id e o access_token da inbox.
    """

    def __init__(self, *, phone_number_id: str, access_token: str, api_version: str = "v20.0"):
        self._phone_number_id = phone_number_id
        self._access_token = access_token
        self._base_url = f"{META_GRAPH_URL}/{api_version}/{phone_number_id}"
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def _post(self, endpoint: str, payload: dict) -> dict:
        url = f"{self._base_url}/{endpoint}"
        try:
            with httpx.Client(timeout=15.0) as http:
                response = http.post(url, json=payload, headers=self._headers)
        except httpx.TimeoutException:
            raise ExternalServiceError("Meta API: timeout ao enviar mensagem.")
        except httpx.RequestError as e:
            raise ExternalServiceError(f"Meta API: erro de rede — {e}")

        if response.status_code >= 400:
            error = response.json().get("error", {})
            logger.error(
                "meta_api_error",
                status=response.status_code,
                code=error.get("code"),
                message=error.get("message"),
                endpoint=endpoint,
            )
            raise ExternalServiceError(
                f"Meta API erro {error.get('code', response.status_code)}: "
                f"{error.get('message', 'Erro desconhecido')}"
            )

        return response.json()

    # ── Envio de mensagens ────────────────────────────────────────────────────

    def send_text(self, *, to: str, text: str, preview_url: bool = False) -> str:
        """
        Envia mensagem de texto.
        Retorna o wa_message_id gerado pela Meta.
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"body": text, "preview_url": preview_url},
        }
        result = self._post("messages", payload)
        return self._extract_message_id(result)

    def send_template(
        self,
        *,
        to: str,
        template_name: str,
        language_code: str = "pt_BR",
        components: Optional[list[dict]] = None,
    ) -> str:
        """
        Envia mensagem de template HSM aprovado pela Meta.
        components: lista de componentes (header, body, button) com parâmetros.
        """
        template: dict[str, Any] = {
            "name": template_name,
            "language": {"code": language_code},
        }
        if components:
            template["components"] = components

        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": template,
        }
        result = self._post("messages", payload)
        return self._extract_message_id(result)

    def send_template_with_params(
        self,
        *,
        to: str,
        template_name: str,
        params: list[str],
        language_code: str = "pt_BR",
    ) -> str:
        """
        Atalho: envia template com parâmetros de texto no body.
        """
        components = [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in params],
            }
        ]
        return self.send_template(
            to=to,
            template_name=template_name,
            language_code=language_code,
            components=components,
        )

    def send_image(self, *, to: str, image_url: str, caption: Optional[str] = None) -> str:
        image: dict[str, Any] = {"link": image_url}
        if caption:
            image["caption"] = caption
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "image",
            "image": image,
        }
        result = self._post("messages", payload)
        return self._extract_message_id(result)

    def send_document(
        self, *, to: str, document_url: str, filename: str, caption: Optional[str] = None
    ) -> str:
        doc: dict[str, Any] = {"link": document_url, "filename": filename}
        if caption:
            doc["caption"] = caption
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "document",
            "document": doc,
        }
        result = self._post("messages", payload)
        return self._extract_message_id(result)

    def send_audio(self, *, to: str, audio_url: str) -> str:
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "audio",
            "audio": {"link": audio_url},
        }
        result = self._post("messages", payload)
        return self._extract_message_id(result)

    # ── Ações de conversa ─────────────────────────────────────────────────────

    def mark_as_read(self, wa_message_id: str) -> bool:
        """Marca mensagem recebida como lida (✓✓ azul no WhatsApp do cliente)."""
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": wa_message_id,
        }
        try:
            self._post("messages", payload)
            return True
        except ExternalServiceError as e:
            logger.warning("mark_as_read_failed", error=str(e), wa_message_id=wa_message_id)
            return False

    # ── Utilitários ───────────────────────────────────────────────────────────

    @staticmethod
    def _extract_message_id(result: dict) -> str:
        messages = result.get("messages", [])
        if not messages:
            raise ExternalServiceError("Meta API não retornou ID de mensagem.")
        return messages[0].get("id", "")

    def get_phone_number_info(self) -> dict:
        """Verifica se o phone_number_id e token são válidos."""
        url = f"{META_GRAPH_URL}/v20.0/{self._phone_number_id}"
        params = {"fields": "display_phone_number,verified_name,quality_rating"}
        try:
            with httpx.Client(timeout=10.0) as http:
                response = http.get(url, headers=self._headers, params=params)
        except httpx.RequestError as e:
            raise ExternalServiceError(f"Meta API: erro ao verificar número — {e}")

        if response.status_code != 200:
            raise ExternalServiceError("Meta API: credenciais inválidas ou phone_number_id incorreto.")
        return response.json()
