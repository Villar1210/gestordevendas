"""
Router interno: /api/ai/config
Configuração de chaves de AI por account. Apenas Admin/Owner.
A chave raw NUNCA aparece em nenhuma resposta.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator

from app.application.ai.config_use_cases import (
    DeleteAIConfigUseCase,
    GetAIConfigUseCase,
    SaveAIConfigUseCase,
    TestAIConfigUseCase,
)
from app.core.dependencies import CurrentUser, require_admin

router = APIRouter(prefix="/ai/config", tags=["AI Config"])

PROVIDER_PATTERN = "^(openai|anthropic)$"


class AIConfigSave(BaseModel):
    provider: str = Field(..., pattern=PROVIDER_PATTERN)
    api_key: str = Field(..., min_length=8, description="Chave de API — será criptografada e nunca retornada.")
    model: Optional[str] = Field(None, max_length=100)
    max_tokens: int = Field(1024, ge=1, le=8192)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    system_prompt: Optional[str] = Field(
        None,
        max_length=4000,
        description="Instrução de sistema do chatbot. Ex: 'Você é um assistente imobiliário...'",
    )
    is_active: bool = True

    @field_validator("api_key")
    @classmethod
    def strip_key(cls, v: str) -> str:
        return v.strip()


@router.post("", summary="Salvar configuração de AI (criptografada)")
async def save_ai_config(
    body: AIConfigSave,
    user: CurrentUser = Depends(require_admin),
):
    """
    Salva/atualiza a chave de API de um provider.
    A chave é criptografada com AES-256-GCM antes de ser persistida.
    A resposta inclui apenas a chave mascarada (ex: sk-abc123********************).
    """
    uc = SaveAIConfigUseCase(user.account_id)
    return uc.execute(
        provider=body.provider,
        api_key=body.api_key,
        model=body.model,
        max_tokens=body.max_tokens,
        temperature=body.temperature,
        system_prompt=body.system_prompt,
        is_active=body.is_active,
    )


@router.get("", summary="Listar configurações de AI")
async def list_ai_configs(
    provider: Optional[str] = Query(None, pattern=PROVIDER_PATTERN),
    user: CurrentUser = Depends(require_admin),
):
    """Lista configs do account. Chave mascarada, nunca exposta."""
    uc = GetAIConfigUseCase(user.account_id)
    return uc.execute(provider=provider)


@router.post("/{provider}/test", summary="Testar chave de AI")
async def test_ai_config(
    provider: str,
    user: CurrentUser = Depends(require_admin),
):
    """Faz uma chamada mínima ao provider para validar a chave salva."""
    uc = TestAIConfigUseCase(user.account_id)
    return uc.execute(provider)


@router.delete("/{provider}", summary="Remover configuração de AI")
async def delete_ai_config(
    provider: str,
    user: CurrentUser = Depends(require_admin),
):
    uc = DeleteAIConfigUseCase(user.account_id)
    return uc.execute(provider)
