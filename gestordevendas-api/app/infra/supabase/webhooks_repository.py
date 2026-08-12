"""Repository para Webhooks"""
from typing import Optional, List
import secrets


class WebhooksRepository:
    """Gerenciar webhooks"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def create_webhook(
        self,
        account_id: str,
        name: str,
        url: str,
        events: List[str],
        description: Optional[str] = None,
        retry_count: int = 3,
        timeout_seconds: int = 30,
    ) -> dict:
        """Criar novo webhook"""
        # Gerar secret único
        secret = secrets.token_urlsafe(32)

        result = await self.supabase.table("webhooks").insert({
            "account_id": account_id,
            "name": name,
            "url": str(url),
            "events": events,
            "description": description,
            "secret": secret,
            "retry_count": retry_count,
            "timeout_seconds": timeout_seconds,
        }).execute()

        return result.data[0] if result.data else None

    async def get_webhooks(
        self,
        account_id: str,
        active_only: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[List[dict], int]:
        """Listar webhooks do tenant"""
        query = self.supabase.table("webhooks").select("*").eq(
            "account_id", account_id
        )

        if active_only:
            query = query.eq("active", True)

        query = query.range(offset, offset + limit - 1)
        result = await query.execute()

        # Contar total
        count_query = self.supabase.table("webhooks").select("id", count="exact").eq(
            "account_id", account_id
        )
        if active_only:
            count_query = count_query.eq("active", True)

        count_result = await count_query.execute()
        total = count_result.count if hasattr(count_result, 'count') else 0

        return result.data if result.data else [], total

    async def get_webhook(self, webhook_id: str, account_id: str) -> Optional[dict]:
        """Obter webhook específico"""
        result = await self.supabase.table("webhooks").select("*").eq(
            "id", webhook_id
        ).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def update_webhook(
        self,
        webhook_id: str,
        account_id: str,
        **kwargs
    ) -> Optional[dict]:
        """Atualizar webhook"""
        result = await self.supabase.table("webhooks").update(
            kwargs
        ).eq("id", webhook_id).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def delete_webhook(self, webhook_id: str, account_id: str) -> bool:
        """Deletar webhook"""
        result = await self.supabase.table("webhooks").delete().eq(
            "id", webhook_id
        ).eq("account_id", account_id).execute()

        return bool(result.data)

    async def create_webhook_log(
        self,
        webhook_id: str,
        event_type: str,
        payload: dict,
        status_code: Optional[int] = None,
        response_body: Optional[str] = None,
        status: str = "pending",
        error_message: Optional[str] = None,
        attempt_number: int = 1,
    ) -> dict:
        """Criar log de execução"""
        result = await self.supabase.table("webhook_logs").insert({
            "webhook_id": webhook_id,
            "event_type": event_type,
            "payload": payload,
            "status_code": status_code,
            "response_body": response_body,
            "status": status,
            "error_message": error_message,
            "attempt_number": attempt_number,
        }).execute()

        return result.data[0] if result.data else None

    async def get_webhook_logs(
        self,
        webhook_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[dict], int]:
        """Obter logs de webhook"""
        query = self.supabase.table("webhook_logs").select("*").eq(
            "webhook_id", webhook_id
        ).order("created_at", desc=True)

        query = query.range(offset, offset + limit - 1)
        result = await query.execute()

        # Contar total
        count_result = await self.supabase.table("webhook_logs").select(
            "id", count="exact"
        ).eq("webhook_id", webhook_id).execute()
        total = count_result.count if hasattr(count_result, 'count') else 0

        return result.data if result.data else [], total

    async def update_webhook_log(
        self,
        log_id: str,
        status: str,
        status_code: Optional[int] = None,
        response_body: Optional[str] = None,
        error_message: Optional[str] = None,
        completed_at: Optional[str] = None,
    ) -> dict:
        """Atualizar log de webhook"""
        update_data = {
            "status": status,
            "completed_at": completed_at,
        }
        if status_code is not None:
            update_data["status_code"] = status_code
        if response_body is not None:
            update_data["response_body"] = response_body
        if error_message is not None:
            update_data["error_message"] = error_message

        result = await self.supabase.table("webhook_logs").update(
            update_data
        ).eq("id", log_id).execute()

        return result.data[0] if result.data else None

    async def get_webhooks_by_event(
        self,
        account_id: str,
        event_type: str,
    ) -> List[dict]:
        """Obter webhooks ativados para um evento específico"""
        result = await self.supabase.table("webhooks").select("*").eq(
            "account_id", account_id
        ).eq("active", True).execute()

        # Filtrar por evento (PostgreSQL array contains)
        webhooks = result.data if result.data else []
        return [w for w in webhooks if event_type in w.get("events", [])]

    async def update_last_triggered(self, webhook_id: str) -> None:
        """Atualizar timestamp de último disparo"""
        await self.supabase.table("webhooks").update({
            "last_triggered_at": "NOW()"
        }).eq("id", webhook_id).execute()
