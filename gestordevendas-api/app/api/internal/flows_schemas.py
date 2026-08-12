"""Schemas para Chatbot Flows (Task 2, Fase 4)"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class NodeConfig(BaseModel):
    """Configuração de um nó"""
    content: Optional[str] = None  # Para message nodes
    variable_name: Optional[str] = None  # Para input nodes
    condition: Optional[dict] = None  # Para decision nodes
    action_type: Optional[str] = None  # Para action nodes

    model_config = {"from_attributes": True}


class FlowNodeCreate(BaseModel):
    """Criar nó de flow"""
    node_type: str = Field(..., example="message")
    title: str
    description: Optional[str] = None
    config: NodeConfig
    position: dict = Field(default_factory=dict, example={"x": 100, "y": 200})

    model_config = {"from_attributes": True}


class FlowNodeResponse(BaseModel):
    """Resposta de nó"""
    id: str
    flow_id: str
    node_type: str
    title: str
    description: Optional[str] = None
    config: dict
    position: dict
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class FlowEdgeCreate(BaseModel):
    """Criar conexão entre nós"""
    from_node_id: str
    to_node_id: str
    condition: dict = Field(default_factory=dict)
    label: Optional[str] = None

    model_config = {"from_attributes": True}


class FlowCreate(BaseModel):
    """Criar flow"""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    nodes: List[FlowNodeCreate] = Field(default_factory=list)
    edges: List[FlowEdgeCreate] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class FlowResponse(BaseModel):
    """Resposta de flow"""
    id: str
    account_id: str
    name: str
    description: Optional[str] = None
    start_node_id: Optional[str] = None
    is_active: bool
    version: int
    nodes: List[FlowNodeResponse] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ConversationSessionResponse(BaseModel):
    """Sessão de conversa"""
    id: str
    flow_id: str
    phone_number: str
    current_node_id: Optional[str] = None
    context: dict
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}
