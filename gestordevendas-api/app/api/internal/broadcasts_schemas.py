"""Schemas para Broadcasts Module (Task 3, Fase 3)"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BroadcastCreate(BaseModel):
    """Criar broadcast"""
    name: str = Field(..., max_length=255)
    message_template_id: str
    recipient_filter: dict = Field(default_factory=dict)
    scheduled_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BroadcastUpdate(BaseModel):
    """Atualizar broadcast"""
    name: Optional[str] = Field(None, max_length=255)
    scheduled_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BroadcastResponse(BaseModel):
    """Resposta de broadcast"""
    id: str
    account_id: str
    name: str
    message_template_id: str
    recipient_filter: dict
    status: str
    scheduled_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    total_recipients: int
    sent_count: int
    failed_count: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class BroadcastStats(BaseModel):
    """Estatísticas de broadcast"""
    broadcast_id: str
    total: int
    sent: int
    failed: int
    pending: int
    success_rate: float

    model_config = {"from_attributes": True}


class BroadcastRecipientResponse(BaseModel):
    """Resposta de destinatário"""
    id: str
    broadcast_id: str
    contact_id: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[str] = None

    model_config = {"from_attributes": True}
