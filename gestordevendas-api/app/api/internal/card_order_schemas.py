"""Schemas para Card Order Persistence (Task 2)"""
from pydantic import BaseModel, Field


class CardOrderUpdate(BaseModel):
    """Atualizar ordem de um card"""
    order_position: int = Field(..., ge=0, description="Posição na ordem (0+)")

    model_config = {"from_attributes": True}


class CardReorderRequest(BaseModel):
    """Reordenar múltiplos cards"""
    orders: list = Field(..., description="Lista de {card_id, order_position}")

    model_config = {"from_attributes": True}
