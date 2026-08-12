"""Endpoints para Webhooks Module (Task 1, Fase 3)"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.webhooks_schemas import (
    WebhookCreate,
    WebhookUpdate,
    WebhookResponse,
    WebhookTestRequest,
    WebhookTestResponse,
)
from app.application.webhooks.use_cases import (
    CreateWebhookUseCase,
    ListWebhooksUseCase,
    GetWebhookUseCase,
    UpdateWebhookUseCase,
    DeleteWebhookUseCase,
    GetWebhookLogsUseCase,
    TriggerWebhookUseCase,
    TestWebhookUseCase,
)
from app.infra.supabase.webhooks_repository import WebhooksRepository

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED, summary="Criar webhook")
async def create_webhook(
    webhook_data: WebhookCreate,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Criar novo webhook"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    webhooks_repository = WebhooksRepository(supabase)
    use_case = CreateWebhookUseCase(webhooks_repository)

    try:
        return await use_case.execute(account_id, webhook_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/", summary="Listar webhooks")
async def list_webhooks(
    active_only: bool = False,
    limit: int = 20,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Listar webhooks do tenant"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    webhooks_repository = WebhooksRepository(supabase)
    use_case = ListWebhooksUseCase(webhooks_repository)

    return await use_case.execute(
        account_id,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )


@router.get("/{webhook_id}", response_model=WebhookResponse, summary="Obter webhook")
async def get_webhook(
    webhook_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter webhook específico"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    webhooks_repository = WebhooksRepository(supabase)
    use_case = GetWebhookUseCase(webhooks_repository)

    try:
        return await use_case.execute(webhook_id, account_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.patch("/{webhook_id}", response_model=WebhookResponse, summary="Atualizar webhook")
async def update_webhook(
    webhook_id: str,
    webhook_data: WebhookUpdate,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Atualizar webhook"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    webhooks_repository = WebhooksRepository(supabase)
    use_case = UpdateWebhookUseCase(webhooks_repository)

    try:
        return await use_case.execute(webhook_id, account_id, webhook_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deletar webhook")
async def delete_webhook(
    webhook_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Deletar webhook"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    webhooks_repository = WebhooksRepository(supabase)
    use_case = DeleteWebhookUseCase(webhooks_repository)

    try:
        await use_case.execute(webhook_id, account_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/{webhook_id}/logs", summary="Obter logs do webhook")
async def get_webhook_logs(
    webhook_id: str,
    limit: int = 50,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter logs de execução do webhook"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    webhooks_repository = WebhooksRepository(supabase)
    use_case = GetWebhookLogsUseCase(webhooks_repository)

    try:
        return await use_case.execute(webhook_id, account_id, limit=limit, offset=offset)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/{webhook_id}/test", response_model=WebhookTestResponse, summary="Testar webhook")
async def test_webhook(
    webhook_id: str,
    test_data: WebhookTestRequest,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Testar webhook enviando um payload de teste"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    webhooks_repository = WebhooksRepository(supabase)
    use_case = TestWebhookUseCase(webhooks_repository)

    try:
        return await use_case.execute(webhook_id, account_id, test_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
