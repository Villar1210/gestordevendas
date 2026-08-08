"""
Enumerações de domínio.
Nenhuma dependência de infra — Python puro.
"""
from enum import Enum


class Role(str, Enum):
    SUPER_ADMIN = "super_admin"  # Módulo Super Usuário: acesso cross-tenant
    OWNER  = "owner"
    ADMIN  = "admin"
    AGENT  = "agent"
    VIEWER = "viewer"

    _ORDER = {"super_admin": 5, "owner": 4, "admin": 3, "agent": 2, "viewer": 1}

    def has_permission(self, min_role: "Role") -> bool:
        """Retorna True se esta role for >= min_role na hierarquia."""
        order = {"super_admin": 5, "owner": 4, "admin": 3, "agent": 2, "viewer": 1}
        return order.get(self.value, 0) >= order.get(min_role.value, 0)


class ConversationStatus(str, Enum):
    OPEN    = "open"
    PENDING = "pending"
    CLOSED  = "closed"


class MessageType(str, Enum):
    TEXT        = "text"
    IMAGE       = "image"
    AUDIO       = "audio"
    VIDEO       = "video"
    DOCUMENT    = "document"
    LOCATION    = "location"
    TEMPLATE    = "template"
    INTERACTIVE = "interactive"
    STICKER     = "sticker"
    REACTION    = "reaction"


class MessageDirection(str, Enum):
    INBOUND  = "inbound"
    OUTBOUND = "outbound"


class MessageStatus(str, Enum):
    SENT      = "sent"
    DELIVERED = "delivered"
    READ      = "read"
    FAILED    = "failed"


class BroadcastStatus(str, Enum):
    DRAFT      = "draft"
    SCHEDULED  = "scheduled"
    SENDING    = "sending"
    COMPLETED  = "completed"
    FAILED     = "failed"
    CANCELLED  = "cancelled"


class RecipientStatus(str, Enum):
    PENDING   = "pending"
    SENT      = "sent"
    DELIVERED = "delivered"
    READ      = "read"
    FAILED    = "failed"


class AutomationStepType(str, Enum):
    TRIGGER          = "trigger"
    CONDITION        = "condition"
    SEND_MESSAGE     = "send_message"
    ASSIGN_AGENT     = "assign_agent"
    ADD_TAG          = "add_tag"
    CLOSE_CONV       = "close_conversation"
    CREATE_DEAL      = "create_deal"
    START_FLOW       = "start_flow"
    SEND_WEBHOOK     = "send_webhook"


class FlowNodeType(str, Enum):
    MESSAGE   = "message"
    QUESTION  = "question"
    CONDITION = "condition"
    ACTION    = "action"
    END       = "end"


class FlowRunStatus(str, Enum):
    RUNNING   = "running"
    WAITING   = "waiting"
    COMPLETED = "completed"
    EXPIRED   = "expired"
    FAILED    = "failed"


class AIProvider(str, Enum):
    OPENAI    = "openai"
    ANTHROPIC = "anthropic"


class Plan(str, Enum):
    FREE       = "free"
    PRO        = "pro"
    ENTERPRISE = "enterprise"


class WebhookEvent(str, Enum):
    MESSAGE_INBOUND       = "message.inbound"
    MESSAGE_STATUS_UPDATE = "message.status_update"
    CONVERSATION_CREATED  = "conversation.created"
    CONVERSATION_CLOSED   = "conversation.closed"
    CONTACT_CREATED       = "contact.created"
    DEAL_STAGE_CHANGED    = "deal.stage_changed"
