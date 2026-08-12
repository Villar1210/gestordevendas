"""Use cases para Automations Module (Task 2, Fase 3)"""
from typing import List, Optional
from datetime import datetime
from app.api.internal.automations_schemas import (
    AutomationCreate,
    AutomationUpdate,
    AutomationResponse,
    AutomationLogResponse,
    ExecutedAction,
)


class CreateAutomationUseCase:
    """Criar nova automação"""

    def __init__(self, automations_repository):
        self.automations_repository = automations_repository

    async def execute(
        self,
        account_id: str,
        automation_data: AutomationCreate,
    ) -> AutomationResponse:
        """Criar automação"""
        # Converter ActionConfig para dict
        actions = [action.model_dump() for action in automation_data.actions]

        automation = await self.automations_repository.create_automation(
            account_id=account_id,
            name=automation_data.name,
            description=automation_data.description,
            trigger_type=automation_data.trigger_type,
            trigger_conditions=automation_data.trigger_conditions,
            actions=actions,
        )

        return AutomationResponse(**automation)


class ListAutomationsUseCase:
    """Listar automações"""

    def __init__(self, automations_repository):
        self.automations_repository = automations_repository

    async def execute(
        self,
        account_id: str,
        active_only: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        """Listar automações do tenant"""
        automations, total = await self.automations_repository.get_automations(
            account_id=account_id,
            active_only=active_only,
            limit=limit,
            offset=offset,
        )

        return {
            "automations": [AutomationResponse(**a) for a in automations],
            "total": total,
            "limit": limit,
            "offset": offset,
        }


class GetAutomationUseCase:
    """Obter automação específica"""

    def __init__(self, automations_repository):
        self.automations_repository = automations_repository

    async def execute(self, automation_id: str, account_id: str) -> AutomationResponse:
        """Obter automação"""
        automation = await self.automations_repository.get_automation(
            automation_id, account_id
        )

        if not automation:
            raise ValueError(f"Automação {automation_id} não encontrada")

        return AutomationResponse(**automation)


class UpdateAutomationUseCase:
    """Atualizar automação"""

    def __init__(self, automations_repository):
        self.automations_repository = automations_repository

    async def execute(
        self,
        automation_id: str,
        account_id: str,
        automation_data: AutomationUpdate,
    ) -> AutomationResponse:
        """Atualizar automação"""
        # Preparar dados para update
        update_data = automation_data.model_dump(exclude_none=True)

        # Converter actions se fornecido
        if "actions" in update_data:
            update_data["actions"] = [
                action.model_dump() for action in update_data["actions"]
            ]

        automation = await self.automations_repository.update_automation(
            automation_id=automation_id,
            account_id=account_id,
            **update_data,
        )

        if not automation:
            raise ValueError(f"Automação {automation_id} não encontrada")

        return AutomationResponse(**automation)


class DeleteAutomationUseCase:
    """Deletar automação"""

    def __init__(self, automations_repository):
        self.automations_repository = automations_repository

    async def execute(self, automation_id: str, account_id: str) -> bool:
        """Deletar automação"""
        success = await self.automations_repository.delete_automation(
            automation_id, account_id
        )

        if not success:
            raise ValueError(f"Automação {automation_id} não encontrada")

        return True


class GetAutomationLogsUseCase:
    """Obter logs de automação"""

    def __init__(self, automations_repository):
        self.automations_repository = automations_repository

    async def execute(
        self,
        automation_id: str,
        account_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Obter logs"""
        # Verificar que automação pertence ao tenant
        automation = await self.automations_repository.get_automation(
            automation_id, account_id
        )
        if not automation:
            raise ValueError(f"Automação {automation_id} não encontrada")

        logs, total = await self.automations_repository.get_automation_logs(
            automation_id=automation_id,
            limit=limit,
            offset=offset,
        )

        return {
            "logs": [AutomationLogResponse(**log) for log in logs],
            "total": total,
            "limit": limit,
            "offset": offset,
        }


class ExecuteAutomationUseCase:
    """Executar automação quando evento ocorre"""

    def __init__(self, automations_repository):
        self.automations_repository = automations_repository

    async def execute(
        self,
        account_id: str,
        trigger_type: str,
        trigger_data: dict,
    ) -> List[dict]:
        """Executar automações para um evento"""
        # Buscar automações ativadas para este trigger
        automations = await self.automations_repository.get_automations_by_trigger(
            account_id, trigger_type
        )

        results = []

        for automation in automations:
            result = await self._execute_automation(automation, trigger_data)
            results.append(result)

        return results

    async def _execute_automation(
        self,
        automation: dict,
        trigger_data: dict,
    ) -> dict:
        """Executar automação individual"""
        automation_id = automation["id"]
        actions = automation.get("actions", [])

        executed_actions = []
        overall_status = "success"

        try:
            for action in actions:
                action_type = action.get("type")
                parameters = action.get("parameters", {})

                try:
                    # Executar ação (aqui você conectaria com as ações reais)
                    action_result = await self._execute_action(
                        action_type, parameters, trigger_data
                    )

                    executed_actions.append({
                        "type": action_type,
                        "parameters": parameters,
                        "status": "success",
                        "result": action_result,
                    })

                except Exception as e:
                    overall_status = "partial" if overall_status == "success" else overall_status
                    executed_actions.append({
                        "type": action_type,
                        "parameters": parameters,
                        "status": "failed",
                        "error_message": str(e),
                    })

            # Criar log
            await self.automations_repository.create_automation_log(
                automation_id=automation_id,
                trigger_data=trigger_data,
                executed_actions=executed_actions,
                status=overall_status,
            )

            # Incrementar contador
            await self.automations_repository.increment_execution_count(automation_id)

            return {
                "automation_id": automation_id,
                "status": overall_status,
                "executed_actions": executed_actions,
            }

        except Exception as e:
            await self.automations_repository.create_automation_log(
                automation_id=automation_id,
                trigger_data=trigger_data,
                executed_actions=executed_actions,
                status="failed",
                error_message=str(e),
            )

            return {
                "automation_id": automation_id,
                "status": "failed",
                "error": str(e),
            }

    async def _execute_action(
        self,
        action_type: str,
        parameters: dict,
        trigger_data: dict,
    ) -> dict:
        """Executar ação específica"""
        # Aqui você conectaria com os serviços reais
        # Por enquanto, retorna um resultado de mock

        if action_type == "send_message":
            return {
                "message_sent": True,
                "template_id": parameters.get("message_template_id"),
            }

        elif action_type == "send_email":
            return {
                "email_sent": True,
                "subject": parameters.get("subject"),
            }

        elif action_type == "create_task":
            return {
                "task_created": True,
                "title": parameters.get("title"),
            }

        elif action_type == "add_tag":
            return {
                "tag_added": True,
                "tag": parameters.get("tag_name"),
            }

        elif action_type == "update_field":
            return {
                "field_updated": True,
                "field": parameters.get("field_name"),
            }

        elif action_type == "create_note":
            return {
                "note_created": True,
                "text": parameters.get("text"),
            }

        else:
            raise ValueError(f"Tipo de ação desconhecido: {action_type}")
