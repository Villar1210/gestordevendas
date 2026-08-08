"""
Entidades de domínio — Python puro (dataclasses).
Sem Pydantic, sem Supabase, sem FastAPI.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.domain.enums import (
    AIProvider, AutomationStepType, BroadcastStatus, ConversationStatus,
    FlowNodeType, FlowRunStatus, MessageDirection, MessageStatus,
    MessageType, Plan, RecipientStatus, Role,
)


# ─── Account / Profile ────────────────────────────────────────────────────────

@dataclass
class Account:
    id: str
    name: str
    owner_id: str
    plan: Plan = Plan.FREE
    white_label_config: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None

    def is_active(self) -> bool:
        return True  # expandir com plano + data de expiração

    def get_plan_limits(self) -> Dict[str, int]:
        limits = {
            Plan.FREE:       {"contacts": 500,   "agents": 2,  "broadcasts_per_month": 5},
            Plan.PRO:        {"contacts": 10_000, "agents": 10, "broadcasts_per_month": 50},
            Plan.ENTERPRISE: {"contacts": -1,     "agents": -1, "broadcasts_per_month": -1},
        }
        return limits.get(self.plan, limits[Plan.FREE])

    @property
    def brand_name(self) -> str:
        return self.white_label_config.get("brand_name", self.name)


@dataclass
class Profile:
    id: str
    account_id: str
    email: str
    name: str
    role: Role
    created_at: Optional[datetime] = None
    is_super_user: bool = False  # Módulo Super Usuário: acesso cross-tenant

    def has_permission(self, min_role: Role) -> bool:
        return self.role.has_permission(min_role)

    def is_owner(self) -> bool:
        return self.role == Role.OWNER

    def is_admin(self) -> bool:
        return self.role.has_permission(Role.ADMIN)

    def is_super_admin(self) -> bool:
        """Super Usuário com acesso cross-tenant."""
        return self.role == Role.SUPER_ADMIN or self.is_super_user


# ─── Contato ──────────────────────────────────────────────────────────────────

@dataclass
class Contact:
    id: str
    account_id: str
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    custom_values: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None


# ─── Conversa / Mensagem ──────────────────────────────────────────────────────

@dataclass
class Conversation:
    id: str
    account_id: str
    contact_id: str
    status: ConversationStatus = ConversationStatus.OPEN
    assigned_agent_id: Optional[str] = None
    ai_enabled: bool = False
    ai_message_count: int = 0
    created_at: Optional[datetime] = None

    def assign(self, agent_id: str) -> None:
        self.assigned_agent_id = agent_id

    def close(self) -> None:
        self.status = ConversationStatus.CLOSED

    def reopen(self) -> None:
        self.status = ConversationStatus.OPEN

    def toggle_ai(self, enabled: bool) -> None:
        self.ai_enabled = enabled
        if enabled:
            self.ai_message_count = 0


@dataclass
class Message:
    id: str
    conversation_id: str
    content: str
    type: MessageType = MessageType.TEXT
    direction: MessageDirection = MessageDirection.INBOUND
    status: MessageStatus = MessageStatus.SENT
    whatsapp_message_id: Optional[str] = None
    media_url: Optional[str] = None
    sender_id: Optional[str] = None
    created_at: Optional[datetime] = None

    def is_inbound(self) -> bool:
        return self.direction == MessageDirection.INBOUND

    def is_media(self) -> bool:
        return self.type in (
            MessageType.IMAGE, MessageType.AUDIO,
            MessageType.VIDEO, MessageType.DOCUMENT,
        )


# ─── Pipeline / Deal ─────────────────────────────────────────────────────────

@dataclass
class PipelineStage:
    id: str
    pipeline_id: str
    name: str
    position: int


@dataclass
class Pipeline:
    id: str
    account_id: str
    name: str
    stages: List[PipelineStage] = field(default_factory=list)


@dataclass
class Deal:
    id: str
    pipeline_id: str
    stage_id: str
    contact_id: Optional[str]
    account_id: str
    title: str
    value: float = 0.0
    owner_id: Optional[str] = None
    conversation_id: Optional[str] = None
    expected_close_date: Optional[datetime] = None
    created_at: Optional[datetime] = None

    def move_to_stage(self, new_stage_id: str) -> None:
        self.stage_id = new_stage_id

    def assign(self, owner_id: str) -> None:
        self.owner_id = owner_id


# ─── Broadcast ───────────────────────────────────────────────────────────────

@dataclass
class Broadcast:
    id: str
    account_id: str
    template_id: str
    status: BroadcastStatus = BroadcastStatus.DRAFT
    scheduled_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    def can_launch(self) -> bool:
        return self.status in (BroadcastStatus.DRAFT, BroadcastStatus.SCHEDULED)

    def cancel(self) -> None:
        self.status = BroadcastStatus.CANCELLED


@dataclass
class BroadcastRecipient:
    id: str
    broadcast_id: str
    contact_id: str
    status: RecipientStatus = RecipientStatus.PENDING
    whatsapp_message_id: Optional[str] = None
    error_message: Optional[str] = None


# ─── Automação ────────────────────────────────────────────────────────────────

@dataclass
class AutomationStep:
    id: str
    automation_id: str
    type: AutomationStepType
    config: Dict[str, Any] = field(default_factory=dict)
    position: int = 0
    next_step_id: Optional[str] = None
    else_step_id: Optional[str] = None


@dataclass
class Automation:
    id: str
    account_id: str
    name: str
    trigger_event: str
    steps: List[AutomationStep] = field(default_factory=list)
    is_active: bool = True
    created_at: Optional[datetime] = None

    def is_triggered_by(self, event_type: str) -> bool:
        return self.trigger_event == event_type


# ─── Flow (Chatbot) ───────────────────────────────────────────────────────────

@dataclass
class FlowEdge:
    target_node_id: str
    condition: Optional[str] = None    # "true" | "false" | None (sempre)


@dataclass
class FlowNode:
    id: str
    flow_id: str
    type: FlowNodeType
    config: Dict[str, Any] = field(default_factory=dict)
    edges: List[FlowEdge] = field(default_factory=list)


@dataclass
class Flow:
    id: str
    account_id: str
    name: str
    trigger_keywords: List[str] = field(default_factory=list)
    nodes: List[FlowNode] = field(default_factory=list)
    is_active: bool = False
    created_at: Optional[datetime] = None

    def get_entry_node(self) -> Optional[FlowNode]:
        return self.nodes[0] if self.nodes else None

    def find_node(self, node_id: str) -> Optional[FlowNode]:
        return next((n for n in self.nodes if n.id == node_id), None)

    def activate(self) -> None:
        self.is_active = True


@dataclass
class FlowRun:
    id: str
    flow_id: str
    conversation_id: str
    current_node_id: str
    status: FlowRunStatus = FlowRunStatus.RUNNING
    waiting_for_response: bool = False
    waiting_since: Optional[datetime] = None
    created_at: Optional[datetime] = None

    def complete(self) -> None:
        self.status = FlowRunStatus.COMPLETED
        self.waiting_for_response = False

    def mark_expired(self) -> None:
        self.status = FlowRunStatus.EXPIRED


# ─── IA ──────────────────────────────────────────────────────────────────────

@dataclass
class AIConfig:
    id: str
    account_id: str
    provider: AIProvider
    model: str
    system_prompt: str
    encrypted_key: str     # NUNCA retornar ao cliente
    is_active: bool = True


@dataclass
class KnowledgeEntry:
    id: str
    account_id: str
    content: str
    embedding: Optional[List[float]] = None
    created_at: Optional[datetime] = None


# ─── WhatsApp Config ──────────────────────────────────────────────────────────

@dataclass
class WhatsAppConfig:
    id: str
    account_id: str
    phone_number_id: str
    waba_id: str
    encrypted_access_token: str    # NUNCA retornar ao cliente
    verify_token: str
    is_active: bool = True


# ─── API Key ─────────────────────────────────────────────────────────────────

@dataclass
class ApiKey:
    id: str
    account_id: str
    name: str
    key_hash: str          # SHA-256 — NUNCA armazenar o raw
    scopes: List[str] = field(default_factory=list)
    is_active: bool = True
    last_used_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes


# ─── Webhook Endpoint ─────────────────────────────────────────────────────────

@dataclass
class WebhookEndpoint:
    id: str
    account_id: str
    url: str
    events: List[str] = field(default_factory=list)
    secret: str = ""
    is_active: bool = True
    fail_count: int = 0
    created_at: Optional[datetime] = None

    def disable(self) -> None:
        self.is_active = False

    def should_disable(self) -> bool:
        return self.fail_count >= 5


# ─── Módulo Super Usuário: Auditoria ────────────────────────────────────────

@dataclass
class AcessoPlataformaLog:
    """Trilha de auditoria de acessos cross-tenant por Super Usuários."""
    id: str
    super_usuario_id: str      # Profile ID do Super Usuário
    account_id: Optional[str]  # Tenant acessado (nullable se tenant for deletado)
    account_nome: str          # Snapshot do nome no momento do acesso
    acao: str                  # "visualizar_dashboard", "asumir_admin", etc
    detalhes: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class PlatformStats:
    """Estatísticas globais da plataforma (todos os tenants)."""
    total_accounts: int = 0
    total_profiles: int = 0
    total_contacts: int = 0
    total_conversations: int = 0
    active_accounts_today: int = 0
    plans_breakdown: Dict[str, int] = field(default_factory=dict)  # {"free": 10, "pro": 5}
    generated_at: Optional[datetime] = None
