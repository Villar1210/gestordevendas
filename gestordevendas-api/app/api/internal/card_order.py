"""Endpoints para Kanban Order Persistence (Task 2)"""
from fastapi import APIRouter, Depends, HTTPException
from app.api.internal.card_order_schemas import CardOrderUpdate, CardReorderRequest
from app.core.auth import get_current_user
from app.application.kanban.use_cases import (
    UpdateCardOrderUseCase,
    ReorderCardsUseCase,
)
from app.infra.supabase.card_order_repository import CardOrderRepository
from app.core.supabase import get_supabase

router = APIRouter(prefix="/cards", tags=["Kanban Order"])


@router.patch("/{card_id}/order", status_code=200)
async def update_card_order(
    card_id: str,
    order_data: CardOrderUpdate,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Atualizar posição de um card no kanban"""
    try:
        repository = CardOrderRepository(supabase)
        use_case = UpdateCardOrderUseCase(repository)

        result = await use_case.execute(
            account_id=user.get("account_id"),
            card_id=card_id,
            order_position=order_data.order_position,
        )

        return {
            "id": result.get("id"),
            "order_position": result.get("order_position"),
            "message": "Card order updated successfully",
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating card order: {str(e)}")


@router.patch("/reorder", status_code=200)
async def reorder_cards(
    reorder_data: CardReorderRequest,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Reordenar múltiplos cards de uma vez"""
    try:
        repository = CardOrderRepository(supabase)
        use_case = ReorderCardsUseCase(repository)

        results = await use_case.execute(
            account_id=user.get("account_id"),
            orders=reorder_data.orders,
        )

        return {
            "updated_count": len(results),
            "cards": [
                {
                    "id": card.get("id"),
                    "order_position": card.get("order_position"),
                }
                for card in results
            ],
            "message": f"{len(results)} cards reordered successfully",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reordering cards: {str(e)}")
