"""Repository para WhatsApp Integration"""
from typing import Optional, List


class WhatsAppRepository:
    """Gerenciar integração WhatsApp"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def create_integration(
        self,
        account_id: str,
        business_account_id: str,
        phone_number_id: str,
        access_token: str,
        phone_number: str,
        webhook_secret: str,
    ) -> dict:
        """Criar integração WhatsApp"""
        result = await self.supabase.table("whatsapp_integrations").insert({
            "account_id": account_id,
            "business_account_id": business_account_id,
            "phone_number_id": phone_number_id,
            "access_token": access_token,
            "phone_number": phone_number,
            "webhook_secret": webhook_secret,
        }).execute()

        return result.data[0] if result.data else None

    async def get_integration(self, account_id: str) -> Optional[dict]:
        """Obter integração do tenant"""
        result = await self.supabase.table("whatsapp_integrations").select("*").eq(
            "account_id", account_id
        ).eq("is_active", True).execute()

        return result.data[0] if result.data else None

    async def update_integration(
        self, account_id: str, **kwargs
    ) -> Optional[dict]:
        """Atualizar integração"""
        result = await self.supabase.table("whatsapp_integrations").update(
            kwargs
        ).eq("account_id", account_id).execute()

        return result.data[0] if result.data else None

    async def save_message(
        self,
        account_id: str,
        integration_id: str,
        message_id: str,
        phone_number: str,
        direction: str,
        message_type: str,
        content: Optional[str] = None,
        media_url: Optional[str] = None,
        status: str = "sent",
    ) -> dict:
        """Salvar mensagem"""
        result = await self.supabase.table("whatsapp_messages").insert({
            "account_id": account_id,
            "integration_id": integration_id,
            "message_id": message_id,
            "phone_number": phone_number,
            "direction": direction,
            "message_type": message_type,
            "content": content,
            "media_url": media_url,
            "status": status,
        }).execute()

        return result.data[0] if result.data else None

    async def get_messages(
        self,
        account_id: str,
        phone_number: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[dict], int]:
        """Obter histórico de mensagens"""
        query = self.supabase.table("whatsapp_messages").select("*").eq(
            "account_id", account_id
        )

        if phone_number:
            query = query.eq("phone_number", phone_number)

        query = query.order("created_at", desc=True).range(
            offset, offset + limit - 1
        )
        result = await query.execute()

        # Contar total
        count_query = self.supabase.table("whatsapp_messages").select(
            "id", count="exact"
        ).eq("account_id", account_id)

        if phone_number:
            count_query = count_query.eq("phone_number", phone_number)

        count_result = await count_query.execute()
        total = count_result.count if hasattr(count_result, 'count') else 0

        return result.data if result.data else [], total

    async def update_message_status(
        self,
        message_id: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> Optional[dict]:
        """Atualizar status da mensagem"""
        update_data = {"status": status}
        if error_message:
            update_data["error_message"] = error_message

        result = await self.supabase.table("whatsapp_messages").update(
            update_data
        ).eq("message_id", message_id).execute()

        return result.data[0] if result.data else None

    async def get_or_create_contact(
        self,
        account_id: str,
        integration_id: str,
        phone_number: str,
        name: Optional[str] = None,
    ) -> dict:
        """Obter ou criar contato"""
        # Buscar contato existente
        result = await self.supabase.table("whatsapp_contacts").select("*").eq(
            "phone_number", phone_number
        ).eq("account_id", account_id).execute()

        if result.data:
            return result.data[0]

        # Criar novo contato
        new_contact = await self.supabase.table("whatsapp_contacts").insert({
            "account_id": account_id,
            "integration_id": integration_id,
            "phone_number": phone_number,
            "name": name,
        }).execute()

        return new_contact.data[0] if new_contact.data else None

    async def get_contacts(
        self,
        account_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[dict], int]:
        """Obter contatos"""
        query = self.supabase.table("whatsapp_contacts").select("*").eq(
            "account_id", account_id
        ).order("last_message_at", desc=True).range(offset, offset + limit - 1)

        result = await query.execute()

        count_result = await self.supabase.table("whatsapp_contacts").select(
            "id", count="exact"
        ).eq("account_id", account_id).execute()
        total = count_result.count if hasattr(count_result, 'count') else 0

        return result.data if result.data else [], total
