"""
DTOs Pydantic compartilhados pelos routers internos.
Validação de entrada e serialização de saída.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ─── Paginação ────────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    per_page: int
    has_next: bool


# ─── Contacts ─────────────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: str = Field(..., min_length=8, max_length=30)
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None
    custom_attributes: Optional[dict[str, Any]] = None
    tags: Optional[list[str]] = None

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        # Remove tudo que não é dígito ou '+'
        cleaned = "".join(c for c in v if c.isdigit() or c == "+")
        if len(cleaned) < 8:
            raise ValueError("Telefone inválido")
        return cleaned


class ContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None
    # Aceita tanto custom_fields (frontend) quanto custom_attributes (legado)
    custom_fields: Optional[dict[str, Any]] = None
    tags: Optional[list[str]] = None

    def to_repo_dict(self) -> dict[str, Any]:
        """Converte para o dict que o repositório espera (custom_attributes no DB)."""
        d = self.model_dump(exclude_unset=True, exclude_none=True)
        if "custom_fields" in d:
            d["custom_attributes"] = d.pop("custom_fields")
        return d


class ContactOut(BaseModel):
    id: UUID
    account_id: UUID
    name: str
    phone: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    # Campo exposto ao frontend como "custom_fields" (DB usa "custom_attributes")
    custom_fields: Optional[dict[str, Any]] = None
    tags: Optional[list[str]] = None
    conversations_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def normalize_custom_fields(cls, data: Any) -> Any:
        """Renomeia custom_attributes -> custom_fields para compatibilidade com o frontend."""
        if isinstance(data, dict) and "custom_attributes" in data and "custom_fields" not in data:
            data = dict(data)  # não muta o original
            data["custom_fields"] = data.pop("custom_attributes")
        return data


class ContactListParams(BaseModel):
    page: int = Field(1, ge=1)
    per_page: int = Field(25, ge=1, le=100)
    search: Optional[str] = None   # nome ou telefone
    tag: Optional[str] = None


# ─── Conversations ────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    contact_id: UUID
    inbox_id: UUID
    initial_message: Optional[str] = None


class ConversationAssign(BaseModel):
    assignee_id: Optional[UUID] = None  # None = desatribuir


class ConversationClose(BaseModel):
    resolution_note: Optional[str] = None


# ─── Sub-modelos para joins de Conversation ──────────────────────────────────

class ContactNested(BaseModel):
    id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    name: str = ""
    phone: str = ""
    email: Optional[str] = None
    tags: list[str] = []
    custom_fields: dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InboxNested(BaseModel):
    id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    name: str = ""
    phone_number_id: str = ""
    is_active: bool = True


class AssigneeNested(BaseModel):
    id: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    email: Optional[str] = None


class LastMessagePreview(BaseModel):
    content: Optional[str] = None


class ConversationOut(BaseModel):
    id: UUID
    account_id: UUID
    contact_id: UUID
    contact: Optional[ContactNested] = None
    inbox_id: UUID
    inbox: Optional[InboxNested] = None
    status: str           # open | resolved | pending | snoozed
    assignee_id: Optional[UUID] = None
    assignee: Optional[AssigneeNested] = None
    ai_enabled: bool
    unread_count: int
    last_message_at: Optional[datetime] = None
    last_message: Optional[LastMessagePreview] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationListParams(BaseModel):
    page: int = Field(1, ge=1)
    per_page: int = Field(25, ge=1, le=100)
    status: Optional[str] = None        # open|resolved|pending|snoozed
    assignee_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    search: Optional[str] = None        # busca no nome do contato


# ─── Messages ─────────────────────────────────────────────────────────────────

class MessageSend(BaseModel):
    content: str = Field(..., min_length=1, max_length=4096)
    message_type: str = Field("text", pattern="^(text|image|document|audio|video|template)$")
    template_name: Optional[str] = None
    template_params: Optional[list[str]] = None
    media_url: Optional[str] = None


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    content: Optional[str] = None
    message_type: str
    direction: str      # inbound | outbound
    status: str         # sent | delivered | read | failed
    sender_id: Optional[UUID] = None
    sender_name: Optional[str] = None
    media_url: Optional[str] = None
    error_code: Optional[str] = None
    wa_message_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageListParams(BaseModel):
    page: int = Field(1, ge=1)
    per_page: int = Field(50, ge=1, le=100)
    before: Optional[datetime] = None   # cursor para paginação reversa
