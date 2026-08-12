"""Schemas para Automations Module (Task 2, Fase 3)"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class ActionConfig(BaseModel):
    """Configuração de ação a ser executada"""
    type: str = Field(..., example="send_message")
    parameters: dict = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class TriggerConfig(BaseModel):
    """Configuração de trigger"""
    type: str = Field(..., example="contact_created")
    conditions: dict = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class AutomationCreate(BaseModel):
    """Criar nova automação"""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    trigger_type: str = Field(
        ...,
        example="contact_created",
        description="contact_created, message_received, lead_qualified, deal_won, scheduled_time"
    )
    trigger_conditions: dict = Field(default_factory=dict)
    actions: List[ActionConfig] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AutomationUpdate(BaseModel):
    """Atualizar automação"""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_conditions: Optional[dict] = None
    actions: Optional[List[ActionConfig]] = None
    active: Optional[bool] = None

    model_config = {"from_attributes": True}


class AutomationResponse(BaseModel):
    """Resposta de automação"""
    id: str
    account_id: str
    name: str
    description: Optional[str] = None
    trigger_type: str
    trigger_conditions: dict
    actions: List[ActionConfig]
    active: bool
    execution_count: int
    last_executed_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ExecutedAction(BaseModel):
    """Ação executada"""
    type: str
    parameters: dict
    status: str  # success, failed, skipped
    result: Optional[dict] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


class AutomationLogResponse(BaseModel):
    """Log de execução de automação"""
    id: str
    automation_id: str
    trigger_data: dict
    executed_actions: List[ExecutedAction]
    status: str  # pending, success, partial, failed
    error_message: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class AutomationLogList(BaseModel):
    """Lista de logs de automação"""
    logs: List[AutomationLogResponse]
    total: int
    limit: int
    offset: int

    model_config = {"from_attributes": True}


class TriggerEventData(BaseModel):
    """Dados do evento que dispara a automação"""
    trigger_type: str
    data: dict
    account_id: str
    timestamp: datetime

    model_config = {"from_attributes": True}


# Tipos de triggers suportados
TRIGGER_TYPES = [
    "contact_created",
    "contact_updated",
    "message_received",
    "lead_qualified",
    "deal_won",
    "deal_lost",
    "scheduled_time",
]

# Tipos de ações suportadas
ACTION_TYPES = [
    "send_message",
    "send_email",
    "create_task",
    "add_tag",
    "update_field",
    "create_note",
]

# Ações disponíveis com suas configurações
AVAILABLE_ACTIONS = {
    "send_message": {
        "description": "Enviar mensagem para contato",
        "parameters": {
            "message_template_id": {"type": "string", "required": True},
            "delay_seconds": {"type": "integer", "required": False, "default": 0},
        }
    },
    "send_email": {
        "description": "Enviar email para contato",
        "parameters": {
            "subject": {"type": "string", "required": True},
            "body": {"type": "string", "required": True},
            "delay_seconds": {"type": "integer", "required": False, "default": 0},
        }
    },
    "create_task": {
        "description": "Criar tarefa para o usuário",
        "parameters": {
            "title": {"type": "string", "required": True},
            "description": {"type": "string", "required": False},
            "assigned_to_user_id": {"type": "string", "required": False},
            "due_date": {"type": "string", "required": False},
        }
    },
    "add_tag": {
        "description": "Adicionar tag ao contato",
        "parameters": {
            "tag_name": {"type": "string", "required": True},
        }
    },
    "update_field": {
        "description": "Atualizar campo customizado do contato",
        "parameters": {
            "field_name": {"type": "string", "required": True},
            "field_value": {"type": "any", "required": True},
        }
    },
    "create_note": {
        "description": "Criar nota no contato",
        "parameters": {
            "text": {"type": "string", "required": True},
        }
    },
}
