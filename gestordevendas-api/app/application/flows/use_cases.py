"""
Use cases de Chatbot Flows.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.domain.exceptions import ConflictError
from app.infra.supabase.flows_repo import ChatbotFlowsRepository, FlowRunsRepository

logger = structlog.get_logger(__name__)


# ── CRUD de Flows ──────────────────────────────────────────────────────────────

class CreateFlowUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ChatbotFlowsRepository(account_id)

    def execute(
        self,
        *,
        name: str,
        nodes: list[dict],
        trigger_keywords: Optional[list[str]] = None,
        description: Optional[str] = None,
        is_active: bool = True,
        created_by: Optional[str] = None,
    ) -> dict:
        _validate_nodes(nodes)
        return self._repo.create(
            name=name,
            nodes=nodes,
            trigger_keywords=trigger_keywords,
            description=description,
            is_active=is_active,
            created_by=created_by,
        )


class GetFlowUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ChatbotFlowsRepository(account_id)

    def execute(self, flow_id: UUID) -> dict:
        return self._repo.get_by_id(flow_id)


class ListFlowsUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ChatbotFlowsRepository(account_id)

    def execute(
        self,
        *,
        page: int = 1,
        per_page: int = 25,
        is_active: Optional[bool] = None,
    ) -> dict:
        items, total = self._repo.list(page=page, per_page=per_page, is_active=is_active)
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (page * per_page) < total,
        }


class UpdateFlowUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ChatbotFlowsRepository(account_id)

    def execute(self, flow_id: UUID, updates: dict) -> dict:
        if "nodes" in updates:
            _validate_nodes(updates["nodes"])
        return self._repo.update(flow_id, updates)


class DeleteFlowUseCase:
    def __init__(self, account_id: UUID):
        self._repo = ChatbotFlowsRepository(account_id)

    def execute(self, flow_id: UUID) -> dict:
        self._repo.delete(flow_id)
        return {"deleted": True, "id": str(flow_id)}


# ── Execução de Flows ──────────────────────────────────────────────────────────

class TriggerFlowUseCase:
    """
    Verifica se a mensagem recebida dispara algum flow via keyword.
    Se sim, cria um flow_run e enfileira o worker para processar o primeiro nó.
    Retorna True se um flow foi disparado, False se não.
    """

    def __init__(self, account_id: UUID):
        self._flows_repo = ChatbotFlowsRepository(account_id)
        self._runs_repo = FlowRunsRepository(account_id)
        self._account_id = account_id

    def execute(self, *, message_text: str, conversation_id: UUID) -> bool:
        if not message_text.strip():
            return False

        # 1. Verifica se já há um flow_run ativo para esta conversa
        active_run = self._runs_repo.get_active_for_conversation(conversation_id)
        if active_run:
            # Avança o flow existente com a resposta do usuário
            self._advance(active_run, user_response=message_text)
            return True

        # 2. Verifica se algum flow é disparado pela mensagem
        flow = self._flows_repo.find_matching_flow(message_text)
        if not flow:
            return False

        # 3. Cria o flow_run e processa o primeiro nó
        run = self._runs_repo.create(
            flow_id=UUID(flow["id"]),
            conversation_id=conversation_id,
        )
        logger.info(
            "flow_triggered",
            flow_id=flow["id"],
            flow_name=flow["name"],
            conversation_id=str(conversation_id),
        )
        self._advance(run, user_response=message_text)
        return True

    def _advance(self, run: dict, *, user_response: str) -> None:
        try:
            from app.workers.flows import advance_flow_run
            advance_flow_run.delay(
                flow_run_id=str(run["id"]),
                account_id=str(self._account_id),
                user_response=user_response,
            )
        except Exception as e:
            logger.error("flow_advance_queue_failed", run_id=run["id"], error=str(e))


class GetFlowRunsUseCase:
    def __init__(self, account_id: UUID):
        self._repo = FlowRunsRepository(account_id)
        self._flows_repo = ChatbotFlowsRepository(account_id)

    def execute(self, flow_id: UUID, *, page: int = 1, per_page: int = 25) -> dict:
        self._flows_repo.get_by_id(flow_id)  # valida que o flow pertence ao account
        items, total = self._repo.list_by_flow(flow_id, page=page, per_page=per_page)
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (page * per_page) < total,
        }


# ── Helpers ────────────────────────────────────────────────────────────────────

VALID_NODE_TYPES = {"message", "condition", "action"}
VALID_ACTION_TYPES = {"assign_conversation", "close_conversation", "add_tag", "remove_tag"}


def _validate_nodes(nodes: list[dict]) -> None:
    from app.domain.exceptions import ValidationError

    if not nodes:
        raise ValidationError("Um flow precisa ter pelo menos 1 nó.")

    for i, node in enumerate(nodes):
        node_type = node.get("type")
        if node_type not in VALID_NODE_TYPES:
            raise ValidationError(
                f"Nó {i}: tipo '{node_type}' inválido. Use: {', '.join(sorted(VALID_NODE_TYPES))}"
            )
        if node_type == "message" and not node.get("content"):
            raise ValidationError(f"Nó {i} (message): campo 'content' obrigatório.")
        if node_type == "condition" and not node.get("conditions"):
            raise ValidationError(f"Nó {i} (condition): campo 'conditions' obrigatório.")
        if node_type == "action":
            action_type = node.get("action_type")
            if action_type not in VALID_ACTION_TYPES:
                raise ValidationError(
                    f"Nó {i} (action): action_type '{action_type}' inválido. "
                    f"Use: {', '.join(sorted(VALID_ACTION_TYPES))}"
                )
