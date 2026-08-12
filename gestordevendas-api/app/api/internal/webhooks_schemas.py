"""Schemas para Webhooks Module (Task 1, Fase 3)"""
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from datetime import datetime


class WebhookCreate(BaseModel):
    """Criar novo webhook"""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    url: HttpUrl = Field(..., description="URL de destino do webhook")
    events: List[str] = Field(
        default=[],
        description="Lista de eventos: contact_created, message_received, etc"
    )
    retry_count: int = Field(default=3, ge=0, le=10)
    timeout_seconds: int = Field(default=30, ge=5, le=120)

    model_config = {"from_attributes": True}


class WebhookUpdate(BaseModel):
    """Atualizar webhook"""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    url: Optional[HttpUrl] = None
    events: Optional[List[str]] = None
    active: Optional[bool] = None
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    timeout_seconds: Optional[int] = Field(None, ge=5, le=120)

    model_config = {"from_attributes": True}


class WebhookResponse(BaseModel):
    """Resposta de webhook"""
    id: str
    account_id: str
    name: str
    description: Optional[str] = None
    url: str
    events: List[str]
    active: bool
    secret: str = Field(..., description="Secret para validação HMAC")
    retry_count: int
    timeout_seconds: int
    last_triggered_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class WebhookLogResponse(BaseModel):
    """Log de execução de webhook"""
    id: str
    webhook_id: str
    event_type: str
    payload: dict
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    attempt_number: int
    status: str  # pending, success, failed, timeout
    error_message: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class WebhookLogList(BaseModel):
    """Lista de logs de webhook"""
    logs: List[WebhookLogResponse]
    total: int
    limit: int
    offset: int

    model_config = {"from_attributes": True}


class WebhookTestRequest(BaseModel):
    """Request para testar webhook"""
    event_type: str = Field(..., example="contact_created")
    test_payload: dict = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class WebhookTestResponse(BaseModel):
    """Resposta de teste de webhook"""
    success: bool
    status_code: Optional[int] = None
    response_time_ms: int
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


class WebhookEvent(BaseModel):
    """Evento disparado internamente"""
    event_type: str
    timestamp: datetime
    data: dict
    account_id: str

    model_config = {"from_attributes": True}
