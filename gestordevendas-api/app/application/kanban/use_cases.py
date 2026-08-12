"""Use cases para Kanban Order Persistence (Task 2)"""
from app.infra.supabase.card_order_repository import CardOrderRepository


class UpdateCardOrderUseCase:
    """Atualizar posição de um card no kanban"""

    def __init__(self, repository: CardOrderRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        card_id: str,
        order_position: int
    ):
        """Atualizar ordem de um card"""
        result = await self.repository.update_card_order(
            account_id,
            card_id,
            order_position
        )

        if not result:
            raise ValueError(f"Card {card_id} not found")

        return result


class ReorderCardsUseCase:
    """Reordenar múltiplos cards de uma vez"""

    def __init__(self, repository: CardOrderRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        orders: list[dict]
    ):
        """Reordenar múltiplos cards"""
        if not orders:
            raise ValueError("Orders list cannot be empty")

        # Validar que cada order tem card_id e order_position
        for order in orders:
            if "card_id" not in order or "order_position" not in order:
                raise ValueError("Each order must have card_id and order_position")

        result = await self.repository.reorder_cards(account_id, orders)

        if not result:
            raise ValueError("No cards were updated")

        return result
