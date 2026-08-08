"""
Worker Celery: engine de chatbot flows.

Um "flow" é uma sequência de nós: message → condition → action → ...
Um "flow_run" rastreia onde um usuário específico está no flow.

Schema esperado:
  chatbot_flows: id, account_id, name, trigger_keywords (JSONB),
                 nodes (JSONB), is_active
  flow_runs:     id, account_id, flow_id, conversation_id,
                 current_node_index, status (running|completed|expired|error),
                 started_at, updated_at
"""
from __future__ import annotations

import logging
from uuid import UUID

from celery import shared_task

logger = logging.getLogger(__name__)

FLOW_RUN_TIMEOUT_MINUTES = 60  # flow_run expira após 60 min sem resposta


@shared_task(
    name="app.workers.flows.advance_flow_run",
    bind=True,
    max_retries=2,
    default_retry_delay=10,
    queue="flows",
)
def advance_flow_run(self, *, flow_run_id: str, account_id: str, user_response: str = ""):
    """
    Avança um flow_run após receber resposta do usuário.
    Processa o nó atual e, se for do tipo "message", envia via WhatsApp.
    Nós de "condition" são avaliados automaticamente sem aguardar input.
    """
    from app.core.supabase import get_supabase_admin

    client = get_supabase_admin()
    account_str = account_id

    try:
        # 1. Carrega o flow_run
        run_res = (
            client.table("flow_runs")
            .select("*")
            .eq("id", flow_run_id)
            .eq("account_id", account_str)
            .single()
            .execute()
        )
        if not run_res.data or run_res.data["status"] != "running":
            logger.info(f"[Flow] flow_run={flow_run_id} não está running, ignorando.")
            return

        run = run_res.data
        flow_id = run["flow_id"]
        current_index = run.get("current_node_index", 0)

        # 2. Carrega o flow
        flow_res = (
            client.table("chatbot_flows")
            .select("nodes")
            .eq("id", flow_id)
            .single()
            .execute()
        )
        if not flow_res.data:
            _fail_run(client, flow_run_id, "flow_not_found")
            return

        nodes: list[dict] = flow_res.data.get("nodes") or []
        if current_index >= len(nodes):
            _complete_run(client, flow_run_id)
            return

        node = nodes[current_index]
        node_type = node.get("type")

        # 3. Processa o nó
        conversation_id = run["conversation_id"]

        if node_type == "message":
            # Envia a mensagem ao usuário
            _send_flow_message(
                account_id=account_str,
                conversation_id=conversation_id,
                text=node.get("content", ""),
            )
            next_index = current_index + 1
            if next_index >= len(nodes):
                _complete_run(client, flow_run_id)
            else:
                next_node = nodes[next_index]
                if next_node.get("type") == "message":
                    # Próximo nó também é mensagem — avança automaticamente
                    _update_run_index(client, flow_run_id, next_index)
                    advance_flow_run.delay(
                        flow_run_id=flow_run_id,
                        account_id=account_id,
                        user_response="",
                    )
                else:
                    # Aguarda input do usuário (condition ou action)
                    _update_run_index(client, flow_run_id, next_index)

        elif node_type == "condition":
            # Avalia a condição com base na resposta do usuário
            match_index = _evaluate_condition_node(node, user_response)
            next_index = current_index + 1 + match_index
            if next_index >= len(nodes):
                _complete_run(client, flow_run_id)
            else:
                _update_run_index(client, flow_run_id, next_index)
                advance_flow_run.delay(
                    flow_run_id=flow_run_id,
                    account_id=account_id,
                    user_response="",
                )

        elif node_type == "action":
            # Executa a ação (ex: assign_conversation, add_tag)
            _execute_action_node(account_str, conversation_id, node)
            next_index = current_index + 1
            if next_index >= len(nodes):
                _complete_run(client, flow_run_id)
            else:
                _update_run_index(client, flow_run_id, next_index)
                advance_flow_run.delay(
                    flow_run_id=flow_run_id,
                    account_id=account_id,
                    user_response="",
                )

        else:
            logger.warning(f"[Flow] Tipo de nó desconhecido: '{node_type}', pulando.")
            _update_run_index(client, flow_run_id, current_index + 1)

    except Exception as e:
        logger.error(f"[Flow] Erro ao avançar flow_run={flow_run_id}: {e}")
        try:
            self.retry(exc=e)
        except Exception:
            _fail_run(client if "client" in dir() else get_supabase_admin(), flow_run_id, str(e))


@shared_task(
    name="app.workers.flows.resume_expired_flows",
    queue="flows",
)
def resume_expired_flows():
    """
    Cron task (a cada 5 min): marca flow_runs aguardando há muito tempo como 'expired'.
    """
    import datetime
    from app.core.supabase import get_supabase_admin

    client = get_supabase_admin()
    threshold = (
        datetime.datetime.utcnow() - datetime.timedelta(minutes=FLOW_RUN_TIMEOUT_MINUTES)
    ).isoformat()

    result = (
        client.table("flow_runs")
        .update({"status": "expired"})
        .eq("status", "running")
        .lt("updated_at", threshold)
        .execute()
    )
    expired_count = len(result.data) if result.data else 0
    if expired_count:
        logger.info(f"[Flow] {expired_count} flow_runs expirados.")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _update_run_index(client, flow_run_id: str, new_index: int) -> None:
    client.table("flow_runs").update({
        "current_node_index": new_index,
        "updated_at": "now()",
    }).eq("id", flow_run_id).execute()


def _complete_run(client, flow_run_id: str) -> None:
    client.table("flow_runs").update({"status": "completed"}).eq(
        "id", flow_run_id
    ).execute()
    logger.info(f"[Flow] flow_run={flow_run_id} concluído.")


def _fail_run(client, flow_run_id: str, reason: str) -> None:
    client.table("flow_runs").update({
        "status": "error",
        "error_reason": reason[:200],
    }).eq("id", flow_run_id).execute()
    logger.error(f"[Flow] flow_run={flow_run_id} falhou: {reason}")


def _send_flow_message(*, account_id: str, conversation_id: str, text: str) -> None:
    if not text:
        return
    try:
        from app.infra.supabase.messages_repo import MessagesRepository
        from uuid import UUID

        repo = MessagesRepository(UUID(account_id))
        message = repo.create(
            conversation_id=UUID(conversation_id),
            content=text,
            message_type="text",
            direction="outbound",
            status="pending",
        )
        from app.workers.whatsapp import send_whatsapp_message
        send_whatsapp_message.delay(
            message_id=str(message["id"]),
            conversation_id=conversation_id,
            account_id=account_id,
        )
    except Exception as e:
        logger.error(f"[Flow] Falha ao enviar mensagem de flow: {e}")


def _evaluate_condition_node(node: dict, user_response: str) -> int:
    """
    Avalia as condições do nó e retorna o offset do próximo nó.
    Formato esperado: node.conditions = [{"operator": "contains", "value": "sim"}]
    Retorna 0 para match, 1 para else.
    """
    conditions = node.get("conditions") or []
    response_lower = user_response.lower().strip()

    for cond in conditions:
        op = cond.get("operator", "contains")
        value = str(cond.get("value", "")).lower()

        match = False
        if op == "contains":
            match = value in response_lower
        elif op == "equals":
            match = response_lower == value
        elif op == "starts_with":
            match = response_lower.startswith(value)

        if match:
            return 0  # branch "true"

    return 1  # branch "false/else"


def _execute_action_node(account_id: str, conversation_id: str, node: dict) -> None:
    """Executa ação de um nó de flow (ex: assign, tag)."""
    action_type = node.get("action_type")
    if not action_type:
        return

    try:
        from app.infra.supabase.conversations_repo import ConversationsRepository
        from uuid import UUID

        repo = ConversationsRepository(UUID(account_id))

        if action_type == "assign_conversation":
            agent_id = node.get("agent_id")
            if agent_id:
                repo.assign(UUID(conversation_id), agent_id)

        elif action_type == "close_conversation":
            repo.close(UUID(conversation_id))

        elif action_type == "add_tag":
            tag = node.get("tag")
            if tag:
                from app.infra.supabase.contacts_repo import ContactsRepository
                conv = repo.get_by_id(UUID(conversation_id))
                contact_id = conv.get("contact_id")
                if contact_id:
                    contact_repo = ContactsRepository(UUID(account_id))
                    contact = contact_repo.get_by_id(UUID(contact_id))
                    existing = contact.get("tags") or []
                    if tag not in existing:
                        contact_repo.update(UUID(contact_id), {"tags": existing + [tag]})
    except Exception as e:
        logger.warning(f"[Flow] Falha ao executar action '{action_type}': {e}")
