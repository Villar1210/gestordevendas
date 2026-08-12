"""Repository para Broadcasts"""
from typing import Optional, List


class BroadcastsRepository:
    """Gerenciar broadcasts"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def create_broadcast(
        self,
        account_id: str,
        name: str,
        message_template_id: str,
        recipient_filter: dict,
        scheduled_at: Optional[str] = None,
    ) -> dict:
        """Criar broadcast"""
        result = await self.supabase.table("broadcasts").insert({
            "account_id": account_id,
            "name": name,
            "message_template_id": message_template_id,
            "recipient_filter": recipient_filter,
            "scheduled_at": scheduled_at,
        }).execute()
        return result.data[0] if result.data else None

    async def get_broadcasts(
        self,
        account_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[List[dict], int]:
        """Listar broadcasts"""
        query = self.supabase.table("broadcasts").select("*").eq(
            "account_id", account_id
        ).order("created_at", desc=True).range(offset, offset + limit - 1)

        result = await query.execute()

        count_result = await self.supabase.table("broadcasts").select(
            "id", count="exact"
        ).eq("account_id", account_id).execute()
        total = count_result.count if hasattr(count_result, 'count') else 0

        return result.data if result.data else [], total

    async def get_broadcast(self, broadcast_id: str, account_id: str) -> Optional[dict]:
        """Obter broadcast"""
        result = await self.supabase.table("broadcasts").select("*").eq(
            "id", broadcast_id
        ).eq("account_id", account_id).execute()
        return result.data[0] if result.data else None

    async def update_broadcast(
        self, broadcast_id: str, account_id: str, **kwargs
    ) -> Optional[dict]:
        """Atualizar broadcast"""
        result = await self.supabase.table("broadcasts").update(
            kwargs
        ).eq("id", broadcast_id).eq("account_id", account_id).execute()
        return result.data[0] if result.data else None

    async def delete_broadcast(self, broadcast_id: str, account_id: str) -> bool:
        """Deletar broadcast"""
        result = await self.supabase.table("broadcasts").delete().eq(
            "id", broadcast_id
        ).eq("account_id", account_id).execute()
        return bool(result.data)

    async def add_recipients(
        self,
        broadcast_id: str,
        recipients: List[dict],
    ) -> List[dict]:
        """Adicionar destinatários"""
        for recipient in recipients:
            recipient["broadcast_id"] = broadcast_id

        result = await self.supabase.table("broadcast_recipients").insert(
            recipients
        ).execute()
        return result.data if result.data else []

    async def get_recipients(
        self,
        broadcast_id: str,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[List[dict], int]:
        """Obter destinatários"""
        query = self.supabase.table("broadcast_recipients").select("*").eq(
            "broadcast_id", broadcast_id
        )

        if status:
            query = query.eq("status", status)

        query = query.range(offset, offset + limit - 1)
        result = await query.execute()

        count_result = await self.supabase.table("broadcast_recipients").select(
            "id", count="exact"
        ).eq("broadcast_id", broadcast_id)
        if status:
            count_result = count_result.eq("status", status)

        total = await count_result.execute()
        total = total.count if hasattr(total, 'count') else 0

        return result.data if result.data else [], total

    async def update_recipient(self, recipient_id: str, **kwargs) -> Optional[dict]:
        """Atualizar destinatário"""
        result = await self.supabase.table("broadcast_recipients").update(
            kwargs
        ).eq("id", recipient_id).execute()
        return result.data[0] if result.data else None
