"""Repository para persistência de ordem de cards"""
from typing import Optional
from app.domain.models import Card


class CardOrderRepository:
    """Persistir e recuperar ordem de cards"""
    
    def __init__(self, supabase):
        self.supabase = supabase
    
    async def update_card_order(
        self, 
        account_id: str, 
        card_id: str, 
        order_position: int
    ) -> Optional[Card]:
        """Atualizar posição de um card"""
        result = await self.supabase.table("cards").update(
            {"order_position": order_position}
        ).eq("id", card_id).eq("account_id", account_id).execute()
        
        return result.data[0] if result.data else None
    
    async def reorder_cards(
        self, 
        account_id: str, 
        orders: list[dict]
    ) -> list[Card]:
        """Reordenar múltiplos cards"""
        results = []
        for order in orders:
            result = await self.update_card_order(
                account_id, 
                order["card_id"], 
                order["order_position"]
            )
            if result:
                results.append(result)
        return results
