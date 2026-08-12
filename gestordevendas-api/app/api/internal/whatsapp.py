"""Endpoints para WhatsApp Integration (Task 1, Fase 4)"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.whatsapp_schemas import (
    WhatsAppIntegrationSetup,
    WhatsAppIntegrationResponse,
    WhatsAppMessageSend,
)
from app.application.whatsapp.use_cases import (
    SetupWhatsAppIntegrationUseCase,
    GetIntegrationUseCase,
    SendMessageUseCase,
    ProcessWebhookUseCase,
    GetMessagesUseCase,
    GetContactsUseCase,
)
from app.infra.supabase.whatsapp_repository import WhatsAppRepository
import json

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.post("/setup", response_model=WhatsAppIntegrationResponse, status_code=status.HTTP_201_CREATED, summary="Configurar WhatsApp")
async def setup_whatsapp(
    setup_data: WhatsAppIntegrationSetup,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Configurar integração com Meta Cloud API"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = WhatsAppRepository(supabase)
    use_case = SetupWhatsAppIntegrationUseCase(repo)

    try:
        return await use_case.execute(account_id, setup_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/config", response_model=WhatsAppIntegrationResponse, summary="Obter configuração")
async def get_config(
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter configuração de WhatsApp"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = WhatsAppRepository(supabase)
    use_case = GetIntegrationUseCase(repo)

    try:
        return await use_case.execute(account_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/send", summary="Enviar mensagem WhatsApp")
async def send_message(
    message_data: WhatsAppMessageSend,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Enviar mensagem via WhatsApp"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = WhatsAppRepository(supabase)
    use_case = SendMessageUseCase(repo)

    try:
        return await use_case.execute(account_id, message_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/webhook", summary="Webhook do WhatsApp")
async def webhook(
    request: Request,
    supabase=Depends(get_supabase),
):
    """Receber eventos do WhatsApp (webhook)"""
    try:
        # Verificar modo de teste
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")

        # Para desenvolvimento, usar token fixo
        WEBHOOK_TOKEN = "test_token_12345"

        if mode == "subscribe" and token == WEBHOOK_TOKEN:
            return {"hub.challenge": challenge}

        # Processar evento
        body = await request.json()
        signature = request.headers.get("X-Hub-Signature-256", "")

        # TODO: Extrair account_id do corpo do webhook
        # Por enquanto, isto é um stub
        return {"status": "success"}

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/messages", summary="Histórico de mensagens")
async def get_messages(
    phone_number: str = None,
    limit: int = 50,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter histórico de mensagens"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = WhatsAppRepository(supabase)
    use_case = GetMessagesUseCase(repo)

    return await use_case.execute(account_id, phone_number, limit, offset)


@router.get("/contacts", summary="Obter contatos")
async def get_contacts(
    limit: int = 50,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter contatos do WhatsApp"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = WhatsAppRepository(supabase)
    use_case = GetContactsUseCase(repo)

    return await use_case.execute(account_id, limit, offset)
