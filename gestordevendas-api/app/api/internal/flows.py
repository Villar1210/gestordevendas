"""Endpoints para Chatbot Flows (Task 2, Fase 4)"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.shared.auth import verify_token
from app.infra.supabase.client import get_supabase
from app.api.internal.flows_schemas import (
    FlowCreate,
    FlowResponse,
    FlowNodeCreate,
    ConversationSessionResponse,
)
from app.infra.supabase.flows_repository import FlowsRepository

router = APIRouter(prefix="/flows", tags=["Flows"])


@router.post("/", response_model=FlowResponse, status_code=status.HTTP_201_CREATED, summary="Criar flow")
async def create_flow(
    flow_data: FlowCreate,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Criar novo flow conversacional"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = FlowsRepository(supabase)

    # Criar flow
    flow = await repo.create_flow(
        account_id=account_id,
        name=flow_data.name,
        description=flow_data.description,
    )

    if not flow:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Erro ao criar flow")

    # Criar nós
    node_map = {}
    for node_data in flow_data.nodes:
        node = await repo.create_node(
            flow_id=flow["id"],
            node_type=node_data.node_type,
            title=node_data.title,
            config=node_data.config.model_dump(),
            position=node_data.position,
            description=node_data.description,
        )
        node_map[node_data.title] = node["id"]

    # Criar arestas
    for edge_data in flow_data.edges:
        await repo.create_edge(
            flow_id=flow["id"],
            from_node_id=edge_data.from_node_id,
            to_node_id=edge_data.to_node_id,
            condition=edge_data.condition,
            label=edge_data.label,
        )

    # Set start node
    first_node_id = list(node_map.values())[0] if node_map else None
    if first_node_id:
        await repo.update_flow(flow["id"], account_id, start_node_id=first_node_id)
        flow["start_node_id"] = first_node_id

    flow["nodes"] = flow_data.nodes

    return FlowResponse(**flow)


@router.get("/", summary="Listar flows")
async def list_flows(
    limit: int = 20,
    offset: int = 0,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Listar flows do tenant"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = FlowsRepository(supabase)
    flows, total = await repo.get_flows(account_id, limit, offset)

    return {
        "flows": [FlowResponse(**f) for f in flows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{flow_id}", response_model=FlowResponse, summary="Obter flow")
async def get_flow(
    flow_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter flow específico"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = FlowsRepository(supabase)
    flow = await repo.get_flow(flow_id, account_id)

    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow não encontrado")

    # Carregar nós
    nodes = await repo.get_nodes(flow_id)
    flow["nodes"] = nodes

    return FlowResponse(**flow)


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deletar flow")
async def delete_flow(
    flow_id: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Deletar flow"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = FlowsRepository(supabase)
    success = await repo.delete_flow(flow_id, account_id)

    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow não encontrado")


@router.post("/{flow_id}/start", summary="Iniciar conversa")
async def start_conversation(
    flow_id: str,
    phone_number: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Iniciar nova conversa"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = FlowsRepository(supabase)
    flow = await repo.get_flow(flow_id, account_id)

    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow não encontrado")

    start_node_id = flow.get("start_node_id")
    if not start_node_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flow sem nó inicial")

    session = await repo.create_session(
        account_id=account_id,
        flow_id=flow_id,
        phone_number=phone_number,
        start_node_id=start_node_id,
    )

    return ConversationSessionResponse(**session)


@router.get("/{flow_id}/session", summary="Obter sessão ativa")
async def get_active_session(
    flow_id: str,
    phone_number: str,
    token: dict = Depends(verify_token),
    supabase=Depends(get_supabase),
):
    """Obter sessão ativa para número"""
    account_id = token.get("account_id")
    if not account_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = FlowsRepository(supabase)
    session = await repo.get_session(phone_number, flow_id)

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada")

    return ConversationSessionResponse(**session)
