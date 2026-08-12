"""Repository para Chatbot Flows"""
from typing import Optional, List


class FlowsRepository:
    """Gerenciar flows"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def create_flow(
        self,
        account_id: str,
        name: str,
        description: Optional[str] = None,
    ) -> dict:
        """Criar flow"""
        result = await self.supabase.table("chatbot_flows").insert({
            "account_id": account_id,
            "name": name,
            "description": description,
        }).execute()
        return result.data[0] if result.data else None

    async def get_flows(self, account_id: str, limit: int = 20, offset: int = 0) -> tuple:
        """Listar flows"""
        query = self.supabase.table("chatbot_flows").select("*").eq(
            "account_id", account_id
        ).order("created_at", desc=True).range(offset, offset + limit - 1)

        result = await query.execute()

        count_result = await self.supabase.table("chatbot_flows").select(
            "id", count="exact"
        ).eq("account_id", account_id).execute()
        total = count_result.count if hasattr(count_result, 'count') else 0

        return result.data if result.data else [], total

    async def get_flow(self, flow_id: str, account_id: str) -> Optional[dict]:
        """Obter flow"""
        result = await self.supabase.table("chatbot_flows").select("*").eq(
            "id", flow_id
        ).eq("account_id", account_id).execute()
        return result.data[0] if result.data else None

    async def update_flow(self, flow_id: str, account_id: str, **kwargs) -> Optional[dict]:
        """Atualizar flow"""
        result = await self.supabase.table("chatbot_flows").update(
            kwargs
        ).eq("id", flow_id).eq("account_id", account_id).execute()
        return result.data[0] if result.data else None

    async def delete_flow(self, flow_id: str, account_id: str) -> bool:
        """Deletar flow"""
        result = await self.supabase.table("chatbot_flows").delete().eq(
            "id", flow_id
        ).eq("account_id", account_id).execute()
        return bool(result.data)

    async def create_node(
        self,
        flow_id: str,
        node_type: str,
        title: str,
        config: dict,
        position: dict,
        description: Optional[str] = None,
    ) -> dict:
        """Criar nó"""
        result = await self.supabase.table("flow_nodes").insert({
            "flow_id": flow_id,
            "node_type": node_type,
            "title": title,
            "config": config,
            "position": position,
            "description": description,
        }).execute()
        return result.data[0] if result.data else None

    async def get_nodes(self, flow_id: str) -> List[dict]:
        """Obter nós de um flow"""
        result = await self.supabase.table("flow_nodes").select("*").eq(
            "flow_id", flow_id
        ).execute()
        return result.data if result.data else []

    async def create_edge(
        self,
        flow_id: str,
        from_node_id: str,
        to_node_id: str,
        condition: dict,
        label: Optional[str] = None,
    ) -> dict:
        """Criar conexão entre nós"""
        result = await self.supabase.table("flow_edges").insert({
            "flow_id": flow_id,
            "from_node_id": from_node_id,
            "to_node_id": to_node_id,
            "condition": condition,
            "label": label,
        }).execute()
        return result.data[0] if result.data else None

    async def get_edges(self, flow_id: str) -> List[dict]:
        """Obter conexões de um flow"""
        result = await self.supabase.table("flow_edges").select("*").eq(
            "flow_id", flow_id
        ).execute()
        return result.data if result.data else []

    async def create_session(
        self,
        account_id: str,
        flow_id: str,
        phone_number: str,
        start_node_id: str,
    ) -> dict:
        """Criar sessão de conversa"""
        result = await self.supabase.table("conversation_sessions").insert({
            "account_id": account_id,
            "flow_id": flow_id,
            "phone_number": phone_number,
            "current_node_id": start_node_id,
        }).execute()
        return result.data[0] if result.data else None

    async def get_session(self, phone_number: str, flow_id: str) -> Optional[dict]:
        """Obter sessão ativa"""
        result = await self.supabase.table("conversation_sessions").select("*").eq(
            "phone_number", phone_number
        ).eq("flow_id", flow_id).eq("status", "active").execute()
        return result.data[0] if result.data else None

    async def update_session(
        self,
        session_id: str,
        current_node_id: Optional[str] = None,
        context: Optional[dict] = None,
        status: Optional[str] = None,
    ) -> Optional[dict]:
        """Atualizar sessão"""
        update_data = {}
        if current_node_id:
            update_data["current_node_id"] = current_node_id
        if context:
            update_data["context"] = context
        if status:
            update_data["status"] = status

        result = await self.supabase.table("conversation_sessions").update(
            update_data
        ).eq("id", session_id).execute()
        return result.data[0] if result.data else None
