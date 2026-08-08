"""
Motor de automações — avalia condições e executa ações.

Condições (conditions JSONB):
  {
    "operator": "and" | "or",   // como combinar as regras
    "rules": [
      { "field": "contact.phone", "op": "contains", "value": "+55" },
      { "field": "conversation.status", "op": "equals", "value": "open" },
      { "field": "message.content", "op": "contains", "value": "preço" }
    ]
  }

Operadores suportados: equals, not_equals, contains, not_contains,
                       starts_with, ends_with, is_empty, is_not_empty,
                       greater_than, less_than

Ações (actions JSONB[]):
  [
    { "type": "send_message", "template_name": "boas_vindas", "params": ["{{contact.name}}"] },
    { "type": "assign_conversation", "assignee_id": "uuid-do-agente" },
    { "type": "add_tag", "tag": "lead-quente" },
    { "type": "webhook_call", "url": "https://...", "method": "POST", "payload": {...} },
    { "type": "update_conversation_status", "status": "resolved" }
  ]

Tipos de gatilho (trigger_event):
  conversation_created, message_received, contact_created,
  conversation_assigned, conversation_resolved
"""
from __future__ import annotations

import re
from typing import Any, Optional
from uuid import UUID

import httpx
import structlog

from app.domain.exceptions import ExternalServiceError

logger = structlog.get_logger(__name__)


class ConditionEvaluator:
    """
    Avalia se o contexto de um evento satisfaz as condições da automação.
    Totalmente stateless — sem acesso a banco.
    """

    def evaluate(self, conditions: dict, context: dict) -> bool:
        """
        context = {
            "contact": {...},
            "conversation": {...},
            "message": {...},   # opcional
        }
        """
        if not conditions or not conditions.get("rules"):
            return True  # Sem condições = sempre dispara

        operator = conditions.get("operator", "and").lower()
        rules = conditions.get("rules", [])

        results = [self._eval_rule(rule, context) for rule in rules]

        if operator == "or":
            return any(results)
        return all(results)  # "and" é o padrão

    def _eval_rule(self, rule: dict, context: dict) -> bool:
        field_path = rule.get("field", "")
        op = rule.get("op", "equals")
        expected = rule.get("value")

        actual = self._resolve_field(field_path, context)

        try:
            return self._apply_op(op, actual, expected)
        except Exception as e:
            logger.warning(
                "condition_eval_error",
                field=field_path,
                op=op,
                error=str(e),
            )
            return False

    @staticmethod
    def _resolve_field(path: str, context: dict) -> Any:
        """Resolve 'contact.phone' → context['contact']['phone']"""
        parts = path.split(".")
        value = context
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        return value

    @staticmethod
    def _apply_op(op: str, actual: Any, expected: Any) -> bool:
        if op == "is_empty":
            return actual is None or actual == "" or actual == []
        if op == "is_not_empty":
            return actual is not None and actual != "" and actual != []

        actual_str = str(actual).lower() if actual is not None else ""
        expected_str = str(expected).lower() if expected is not None else ""

        if op == "equals":
            return actual_str == expected_str
        if op == "not_equals":
            return actual_str != expected_str
        if op == "contains":
            return expected_str in actual_str
        if op == "not_contains":
            return expected_str not in actual_str
        if op == "starts_with":
            return actual_str.startswith(expected_str)
        if op == "ends_with":
            return actual_str.endswith(expected_str)
        if op == "greater_than":
            return float(actual or 0) > float(expected or 0)
        if op == "less_than":
            return float(actual or 0) < float(expected or 0)
        if op == "matches_regex":
            return bool(re.search(expected_str, actual_str))

        logger.warning("unknown_operator", op=op)
        return False


class ActionExecutor:
    """
    Executa as ações de uma automação dado o contexto do evento.
    """

    def __init__(self, account_id: UUID):
        self._account_id = account_id

    def execute_all(self, actions: list[dict], context: dict) -> list[dict]:
        """
        Executa todas as ações em ordem.
        Retorna lista de resultados: [{"action": ..., "ok": bool, "error": str}]
        """
        results = []
        for action in actions:
            action_type = action.get("type", "")
            try:
                self._dispatch(action_type, action, context)
                results.append({"action": action_type, "ok": True})
                logger.info("action_executed", action=action_type, account_id=str(self._account_id))
            except Exception as e:
                logger.error("action_failed", action=action_type, error=str(e))
                results.append({"action": action_type, "ok": False, "error": str(e)})
        return results

    def _dispatch(self, action_type: str, action: dict, context: dict) -> None:
        dispatch = {
            "send_message": self._send_message,
            "send_text":    self._send_text,
            "assign_conversation": self._assign_conversation,
            "add_tag":      self._add_tag,
            "remove_tag":   self._remove_tag,
            "webhook_call": self._webhook_call,
            "update_conversation_status": self._update_conv_status,
        }
        handler = dispatch.get(action_type)
        if handler is None:
            logger.warning("unknown_action_type", action=action_type)
            return
        handler(action, context)

    # ── Ações ─────────────────────────────────────────────────────────────────

    def _send_message(self, action: dict, context: dict) -> None:
        """Envia template WhatsApp via worker Celery."""
        from app.workers.whatsapp import send_whatsapp_message

        conversation_id = self._get_context_id(context, "conversation")
        if not conversation_id:
            raise ValueError("conversation_id ausente no contexto para send_message")

        # Registra a mensagem e enfileira o envio
        from app.application.conversations.messages_use_cases import SendMessageUseCase
        uc = SendMessageUseCase(self._account_id)

        # Interpola variáveis {{contact.name}} etc.
        params = [
            self._interpolate(p, context)
            for p in action.get("params", [])
        ]
        uc.execute(
            UUID(conversation_id),
            content=action.get("template_name", ""),
            message_type="template",
            template_name=action.get("template_name"),
            template_params=params if params else None,
        )

    def _send_text(self, action: dict, context: dict) -> None:
        """Envia texto livre (útil para mensagens de boas-vindas simples)."""
        conversation_id = self._get_context_id(context, "conversation")
        if not conversation_id:
            raise ValueError("conversation_id ausente no contexto para send_text")

        text = self._interpolate(action.get("text", ""), context)
        from app.application.conversations.messages_use_cases import SendMessageUseCase
        uc = SendMessageUseCase(self._account_id)
        uc.execute(UUID(conversation_id), content=text, message_type="text")

    def _assign_conversation(self, action: dict, context: dict) -> None:
        conversation_id = self._get_context_id(context, "conversation")
        if not conversation_id:
            raise ValueError("conversation_id ausente para assign_conversation")

        assignee_id = action.get("assignee_id")
        from app.application.conversations.use_cases import AssignConversationUseCase
        uc = AssignConversationUseCase(self._account_id)
        uc.execute(
            UUID(conversation_id),
            UUID(assignee_id) if assignee_id else None,
        )

    def _add_tag(self, action: dict, context: dict) -> None:
        contact_id = self._get_context_id(context, "contact")
        if not contact_id:
            return
        tag = action.get("tag", "")
        if not tag:
            return
        from app.core.supabase import get_supabase_admin
        db = get_supabase_admin()
        # Adiciona tag ao array (sem duplicar)
        db.rpc("add_contact_tag", {
            "p_contact_id": contact_id,
            "p_tag": tag,
        }).execute()

    def _remove_tag(self, action: dict, context: dict) -> None:
        contact_id = self._get_context_id(context, "contact")
        if not contact_id:
            return
        tag = action.get("tag", "")
        if not tag:
            return
        from app.core.supabase import get_supabase_admin
        db = get_supabase_admin()
        db.rpc("remove_contact_tag", {
            "p_contact_id": contact_id,
            "p_tag": tag,
        }).execute()

    def _webhook_call(self, action: dict, context: dict) -> None:
        url = action.get("url", "")
        method = action.get("method", "POST").upper()
        headers = action.get("headers", {})
        payload = action.get("payload", context)  # Padrão: envia o contexto completo

        try:
            with httpx.Client(timeout=10.0) as http:
                if method == "POST":
                    resp = http.post(url, json=payload, headers=headers)
                elif method == "GET":
                    resp = http.get(url, headers=headers)
                else:
                    resp = http.request(method, url, json=payload, headers=headers)

            if resp.status_code >= 400:
                raise ExternalServiceError(
                    f"Webhook retornou {resp.status_code}: {resp.text[:200]}"
                )
        except httpx.RequestError as e:
            raise ExternalServiceError(f"Erro ao chamar webhook: {e}")

    def _update_conv_status(self, action: dict, context: dict) -> None:
        conversation_id = self._get_context_id(context, "conversation")
        if not conversation_id:
            raise ValueError("conversation_id ausente para update_conversation_status")

        new_status = action.get("status", "open")
        if new_status == "resolved":
            from app.application.conversations.use_cases import CloseConversationUseCase
            CloseConversationUseCase(self._account_id).execute(UUID(conversation_id))
        elif new_status == "open":
            from app.application.conversations.use_cases import ReopenConversationUseCase
            ReopenConversationUseCase(self._account_id).execute(UUID(conversation_id))

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _get_context_id(context: dict, entity: str) -> Optional[str]:
        entity_data = context.get(entity, {})
        return entity_data.get("id") if isinstance(entity_data, dict) else None

    @staticmethod
    def _interpolate(template: str, context: dict) -> str:
        """Substitui {{contact.name}}, {{conversation.id}} etc. no texto."""
        import re
        def replacer(match):
            path = match.group(1).strip()
            parts = path.split(".")
            value = context
            for part in parts:
                if isinstance(value, dict):
                    value = value.get(part, "")
                else:
                    return ""
            return str(value)
        return re.sub(r"\{\{(.+?)\}\}", replacer, template)
