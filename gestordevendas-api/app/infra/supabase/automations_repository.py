"""Repository para Automations"""
from typing import Optional, List


class AutomationsRepository:
    """Gerenciar automações"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def create_automation(
        self,
        account_id: str,
        name: str,
        trigger_type: str,
        trigger_conditions: dict,
        actions: List[dict],
        description: Optional[str] = None,
    ) -> dict:
        """Criar nova automação"""
        result = await self.supabase.table("automations").insert({
            "account_id": account_id,
            "name": name,
            "description": description,
            "trigger_type": trigger_type,
            "trigger_conditions": trigger_conditions,
            "actions": actions,
        }).execute()

        return result.data[0] if result.data else None

    async def get_automations(
        self,
        account_id: str,
        active_only: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[List[dict], int]:
        """Listar automações do tenant"""
        query = self.supabase.table("automations").select("*").eq(
            "account_id", account_id
        )

        if active_only:
            query = query.eq("active", True)

        query = query.range(offset, offset + limit - 1)
        result = await query.execute()

        # Contar total
        count_query = self.supabase.table("automations").select("id", count="exact").eq(
            "account_id", account_id
        )
        if active_only:
            count_query = count_query.eq("active", True)

        count_result = await count_query.execute()
        total = count_result.count if hasattr(count_result, 'count') else 0

        return result.data if result.data else [], total

    async def get_automation(self, automation_id: str, account_id: str) -> Optional[dict]:
        """Obter automação específica"""
        result = await self.supabase.table("automations").select("*").eq(
            "id", automation_id
        ).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def update_automation(
        self,
        automation_id: str,
        account_id: str,
        **kwargs
    ) -> Optional[dict]:
        """Atualizar automação"""
        result = await self.supabase.table("automations").update(
            kwargs
        ).eq("id", automation_id).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def delete_automation(self, automation_id: str, account_id: str) -> bool:
        """Deletar automação"""
        result = await self.supabase.table("automations").delete().eq(
            "id", automation_id
        ).eq("account_id", account_id).execute()

        return bool(result.data)

    async def get_automations_by_trigger(
        self,
        account_id: str,
        trigger_type: str,
    ) -> List[dict]:
        """Obter automações ativadas para um trigger específico"""
        result = await self.supabase.table("automations").select("*").eq(
            "account_id", account_id
        ).eq("trigger_type", trigger_type).eq("active", True).execute()

        return result.data if result.data else []

    async def create_automation_log(
        self,
        automation_id: str,
        trigger_data: dict,
        executed_actions: List[dict],
        status: str = "pending",
        error_message: Optional[str] = None,
    ) -> dict:
        """Criar log de execução"""
        result = await self.supabase.table("automation_logs").insert({
            "automation_id": automation_id,
            "trigger_data": trigger_data,
            "executed_actions": executed_actions,
            "status": status,
            "error_message": error_message,
        }).execute()

        return result.data[0] if result.data else None

    async def get_automation_logs(
        self,
        automation_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[dict], int]:
        """Obter logs de automação"""
        query = self.supabase.table("automation_logs").select("*").eq(
            "automation_id", automation_id
        ).order("created_at", desc=True)

        query = query.range(offset, offset + limit - 1)
        result = await query.execute()

        # Contar total
        count_result = await self.supabase.table("automation_logs").select(
            "id", count="exact"
        ).eq("automation_id", automation_id).execute()
        total = count_result.count if hasattr(count_result, 'count') else 0

        return result.data if result.data else [], total

    async def update_automation_log(
        self,
        log_id: str,
        status: str,
        executed_actions: Optional[List[dict]] = None,
        error_message: Optional[str] = None,
    ) -> dict:
        """Atualizar log de automação"""
        update_data = {"status": status}

        if executed_actions is not None:
            update_data["executed_actions"] = executed_actions
        if error_message is not None:
            update_data["error_message"] = error_message

        result = await self.supabase.table("automation_logs").update(
            update_data
        ).eq("id", log_id).execute()

        return result.data[0] if result.data else None

    async def increment_execution_count(self, automation_id: str) -> None:
        """Incrementar contador de execuções"""
        # Buscar automação atual
        result = await self.supabase.table("automations").select("execution_count").eq(
            "id", automation_id
        ).execute()

        if result.data:
            current = result.data[0].get("execution_count", 0)
            await self.supabase.table("automations").update({
                "execution_count": current + 1,
                "last_executed_at": "NOW()"
            }).eq("id", automation_id).execute()
