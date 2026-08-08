"""
Use cases de Automations.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from app.application.automations.engine import ActionExecutor, ConditionEvaluator
from app.infra.supabase.automations_repo import AutomationsRepository

logger = structlog.get_logger(__name__)


class CreateAutomationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = AutomationsRepository(account_id)

    def execute(
        self,
        *,
        name: str,
        trigger_event: str,
        actions: list[dict],
        conditions: Optional[dict] = None,
        description: Optional[str] = None,
        is_active: bool = True,
    ) -> dict:
        return self._repo.create(
            name=name,
            trigger_event=trigger_event,
            actions=actions,
            conditions=conditions,
            description=description,
            is_active=is_active,
        )


class GetAutomationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = AutomationsRepository(account_id)

    def execute(self, automation_id: UUID) -> dict:
        return self._repo.get_by_id(automation_id)


class ListAutomationsUseCase:
    def __init__(self, account_id: UUID):
        self._repo = AutomationsRepository(account_id)

    def execute(
        self,
        *,
        is_active: Optional[bool] = None,
        trigger_event: Optional[str] = None,
    ) -> list[dict]:
        return self._repo.list(is_active=is_active, trigger_event=trigger_event)


class UpdateAutomationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = AutomationsRepository(account_id)

    def execute(self, automation_id: UUID, data: dict) -> dict:
        return self._repo.update(automation_id, data)


class DeleteAutomationUseCase:
    def __init__(self, account_id: UUID):
        self._repo = AutomationsRepository(account_id)

    def execute(self, automation_id: UUID) -> None:
        self._repo.delete(automation_id)


class TriggerAutomationsUseCase:
    """
    Avalia e dispara TODAS as automações ativas para um evento.
    Chamado após eventos: mensagem recebida, conversa criada, etc.

    Design decision: chamado INLINE pelo webhook_processor por ora (Fase 4).
    Em produção com muitas automações, mover para worker Celery via
    trigger_automations.delay(event, context, account_id).
    """

    def __init__(self, account_id: UUID):
        self._account_id = account_id
        self._repo = AutomationsRepository(account_id)
        self._evaluator = ConditionEvaluator()
        self._executor = ActionExecutor(account_id)

    def execute(self, trigger_event: str, context: dict) -> None:
        automations = self._repo.get_active_for_event(trigger_event)
        if not automations:
            return

        logger.info(
            "automations_triggered",
            event=trigger_event,
            count=len(automations),
            account_id=str(self._account_id),
        )

        for automation in automations:
            automation_id = UUID(automation["id"])
            try:
                conditions = automation.get("conditions") or {}
                if not self._evaluator.evaluate(conditions, context):
                    self._repo.log_execution(
                        automation_id=automation_id,
                        entity_id=context.get("conversation", {}).get("id", ""),
                        entity_type="conversation",
                        status="skipped",
                    )
                    continue

                results = self._executor.execute_all(automation.get("actions", []), context)
                all_ok = all(r["ok"] for r in results)
                failed = [r for r in results if not r["ok"]]

                self._repo.log_execution(
                    automation_id=automation_id,
                    entity_id=context.get("conversation", {}).get("id", ""),
                    entity_type="conversation",
                    status="success" if all_ok else "partial",
                    error_message=str(failed) if failed else None,
                )

            except Exception as e:
                logger.error(
                    "automation_execution_error",
                    automation_id=str(automation_id),
                    error=str(e),
                )
                try:
                    self._repo.log_execution(
                        automation_id=automation_id,
                        entity_id="",
                        entity_type="unknown",
                        status="failed",
                        error_message=str(e)[:500],
                    )
                except Exception:
                    pass


class GetExecutionLogsUseCase:
    def __init__(self, account_id: UUID):
        self._repo = AutomationsRepository(account_id)

    def execute(self, automation_id: UUID, *, limit: int = 50) -> list[dict]:
        return self._repo.list_executions(automation_id, limit=limit)
