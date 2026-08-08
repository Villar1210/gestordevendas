"""
AI Conversation Service — responde automaticamente quando ai_enabled=True.

Fluxo:
  1. Busca histórico recente da conversa (últimas N mensagens)
  2. Busca contexto relevante na knowledge base (busca semântica)
  3. Monta o prompt com: system_prompt + contexto KB + histórico
  4. Chama o provider configurado (OpenAI ou Anthropic)
  5. Enfileira o envio da resposta via WhatsApp
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.domain.exceptions import ExternalServiceError

logger = structlog.get_logger(__name__)

MAX_HISTORY_MESSAGES = 10
MAX_KB_RESULTS = 3
DEFAULT_SYSTEM_PROMPT = (
    "Você é um assistente virtual prestativo. "
    "Responda de forma clara, cordial e concisa. "
    "Se não souber a resposta, diga que vai verificar e retornará em breve."
)


class AIConversationService:
    """
    Orquestra a resposta automática via AI para uma conversa.
    Chamado pelo WebhookProcessor quando ai_enabled=True.
    """

    def __init__(self, account_id: UUID):
        self._account_id = account_id

    def process_inbound_message(
        self,
        *,
        conversation_id: str,
        inbound_text: str,
        contact_name: Optional[str] = None,
        inbox_id: str,
    ) -> Optional[str]:
        """
        Gera e enfileira uma resposta de AI para a mensagem recebida.
        Retorna o texto da resposta ou None se falhar silenciosamente.
        """
        # 1. Carrega configuração de AI
        try:
            from app.infra.supabase.ai_config_repo import AIConfigRepository
            ai_repo = AIConfigRepository(self._account_id)
            config = ai_repo.get_active()
            if not config:
                logger.info("ai_no_config", account_id=str(self._account_id))
                return None
        except Exception as e:
            logger.warning("ai_config_load_failed", error=str(e))
            return None

        provider = config["provider"]

        # 2. Busca histórico recente
        history = self._get_history(conversation_id)

        # 3. Busca contexto na knowledge base
        kb_context = self._search_knowledge(inbound_text)

        # 4. Monta prompt
        system_prompt = config.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
        if kb_context:
            system_prompt += "\n\nInformações relevantes da base de conhecimento:\n" + kb_context

        messages = self._build_messages(
            history=history,
            current_message=inbound_text,
            contact_name=contact_name,
        )

        # 5. Chama o provider
        try:
            raw_key = ai_repo.get_decrypted_key(provider)
            response_text = self._call_provider(
                provider=provider,
                api_key=raw_key,
                messages=messages,
                system_prompt=system_prompt,
                model=config.get("model"),
                max_tokens=config.get("max_tokens", 1024),
                temperature=config.get("temperature", 0.7),
            )
        except ExternalServiceError as e:
            logger.warning("ai_call_failed", provider=provider, error=str(e))
            return None
        except Exception as e:
            logger.error("ai_unexpected_error", error=str(e))
            return None

        if not response_text:
            return None

        # 6. Enfileira envio via WhatsApp worker
        self._enqueue_response(
            conversation_id=conversation_id,
            inbox_id=inbox_id,
            text=response_text,
        )

        logger.info(
            "ai_response_enqueued",
            conversation_id=conversation_id,
            provider=provider,
            length=len(response_text),
        )
        return response_text

    def _get_history(self, conversation_id: str) -> list[dict]:
        try:
            from app.infra.supabase.messages_repo import MessagesRepository
            # MessagesRepository precisa de account_id; conversation pode ter
            # outro account — mas está escopado pelo account_id da chamada
            # (o WebhookProcessor já validou a inbox → account)
            repo = MessagesRepository(self._account_id)
            messages, _ = repo.list_by_conversation(
                UUID(conversation_id),
                page=1,
                per_page=MAX_HISTORY_MESSAGES,
            )
            return messages
        except Exception as e:
            logger.warning("ai_history_failed", error=str(e))
            return []

    def _search_knowledge(self, query: str) -> str:
        try:
            from app.infra.supabase.knowledge_repo import KnowledgeRepository
            from app.infra.supabase.ai_config_repo import AIConfigRepository

            ai_repo = AIConfigRepository(self._account_id)
            kb_repo = KnowledgeRepository(self._account_id)

            config = ai_repo.get_active()
            if config and config.get("provider") == "openai":
                raw_key = ai_repo.get_decrypted_key("openai")
                from app.infra.ai_providers.openai_client import OpenAIClient
                embedding = OpenAIClient(raw_key).embed(query)
                results = kb_repo.search_by_embedding(embedding, limit=MAX_KB_RESULTS)
            else:
                results = kb_repo.search_by_text(query, limit=MAX_KB_RESULTS)

            if not results:
                return ""

            return "\n---\n".join(
                f"Título: {r.get('title', '')}\n{r.get('content', '')}"
                for r in results
            )
        except Exception as e:
            logger.warning("ai_kb_search_failed", error=str(e))
            return ""

    def _build_messages(
        self,
        *,
        history: list[dict],
        current_message: str,
        contact_name: Optional[str],
    ) -> list[dict]:
        """
        Constrói o array de mensagens no formato OpenAI (também compatível com Anthropic).
        Histórico: inbound → role=user, outbound → role=assistant.
        """
        messages: list[dict] = []

        for msg in reversed(history):  # history vem reverso (mais novo primeiro)
            direction = msg.get("direction", "")
            content = msg.get("content", "")
            if not content:
                continue
            if direction == "inbound":
                messages.append({"role": "user", "content": content})
            elif direction == "outbound":
                messages.append({"role": "assistant", "content": content})

        # Adiciona a mensagem atual
        user_prefix = f"{contact_name}: " if contact_name else ""
        messages.append({"role": "user", "content": f"{user_prefix}{current_message}"})

        return messages

    def _call_provider(
        self,
        *,
        provider: str,
        api_key: str,
        messages: list[dict],
        system_prompt: str,
        model: Optional[str],
        max_tokens: int,
        temperature: float,
    ) -> str:
        if provider == "openai":
            from app.infra.ai_providers.openai_client import OpenAIClient, DEFAULT_CHAT_MODEL
            full_messages = [{"role": "system", "content": system_prompt}] + messages
            return OpenAIClient(api_key).chat(
                full_messages,
                model=model or DEFAULT_CHAT_MODEL,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        elif provider == "anthropic":
            from app.infra.ai_providers.anthropic_client import AnthropicClient, DEFAULT_MODEL
            return AnthropicClient(api_key).chat(
                messages,
                model=model or DEFAULT_MODEL,
                max_tokens=max_tokens,
                temperature=temperature,
                system_prompt=system_prompt,
            )
        else:
            raise ExternalServiceError(f"Provider '{provider}' não suportado.")

    def _enqueue_response(
        self,
        *,
        conversation_id: str,
        inbox_id: str,
        text: str,
    ) -> None:
        """
        Persiste a mensagem outbound e enfileira o worker WhatsApp.
        Reutiliza o fluxo existente de send_whatsapp_message.
        """
        from app.infra.supabase.messages_repo import MessagesRepository
        from app.infra.supabase.conversations_repo import ConversationsRepository

        msgs_repo = MessagesRepository(self._account_id)
        conv_repo = ConversationsRepository(self._account_id)

        # Busca conversa para obter o phone_number_id e contact phone
        conversation = conv_repo.get_by_id(UUID(conversation_id))
        contact_phone = conversation.get("contact", {}).get("phone", "")

        # Cria registro da mensagem outbound
        message = msgs_repo.create(
            conversation_id=UUID(conversation_id),
            content=text,
            message_type="text",
            direction="outbound",
            status="pending",
            sent_by_ai=True,  # campo opcional — o schema pode ter ou não
        )

        # Enfileira envio real (conversation_id é obrigatório no worker)
        try:
            from app.workers.whatsapp import send_whatsapp_message
            send_whatsapp_message.delay(
                message_id=str(message["id"]),
                conversation_id=conversation_id,
                account_id=str(self._account_id),
            )
        except Exception as e:
            logger.error("ai_enqueue_send_failed", error=str(e))
