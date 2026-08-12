"""Schemas para WhatsApp Integration (Task 1, Fase 4)"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class WhatsAppIntegrationSetup(BaseModel):
    """Configurar integração WhatsApp"""
    business_account_id: str = Field(..., description="ID da conta comercial Meta")
    phone_number_id: str = Field(..., description="ID do número de telefone")
    access_token: str = Field(..., description="Token de acesso Meta (será encriptado)")
    phone_number: str = Field(..., example="+5511999999999")
    webhook_secret: str = Field(..., description="Secret para validar webhooks")

    model_config = {"from_attributes": True}


class WhatsAppIntegrationResponse(BaseModel):
    """Resposta de configuração WhatsApp"""
    id: str
    account_id: str
    business_account_id: str
    phone_number_id: str
    phone_number: str
    is_active: bool
    webhook_url: Optional[str] = None
    last_sync_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class WhatsAppMessageSend(BaseModel):
    """Enviar mensagem WhatsApp"""
    phone_number: str = Field(..., example="+5511999999999")
    message_type: str = Field(default="text", example="text")
    content: Optional[str] = None
    media_url: Optional[str] = None

    model_config = {"from_attributes": True}


class WhatsAppMessageResponse(BaseModel):
    """Resposta de mensagem WhatsApp"""
    id: str
    message_id: Optional[str] = None
    phone_number: str
    direction: str
    message_type: str
    content: Optional[str] = None
    media_url: Optional[str] = None
    status: str
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class WhatsAppContactResponse(BaseModel):
    """Contato do WhatsApp"""
    id: str
    phone_number: str
    name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    first_message_at: Optional[str] = None
    last_message_at: Optional[str] = None
    message_count: int

    model_config = {"from_attributes": True}


class WebhookMessageEvent(BaseModel):
    """Evento de mensagem do webhook do WhatsApp"""
    phone_number: str
    message_id: str
    message_type: str
    content: Optional[str] = None
    media_url: Optional[str] = None
    timestamp: str

    model_config = {"from_attributes": True}


class WebhookStatusEvent(BaseModel):
    """Evento de status do webhook"""
    message_id: str
    status: str  # sent, delivered, read, failed
    timestamp: str

    model_config = {"from_attributes": True}
