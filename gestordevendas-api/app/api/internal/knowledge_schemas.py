"""Schemas para Knowledge Base Vector Search (Task 3)"""
from pydantic import BaseModel, Field
from typing import Optional


class KnowledgeBaseCreate(BaseModel):
    """Criar novo documento de conhecimento"""
    title: str = Field(..., min_length=1, max_length=255, description="Título do documento")
    content: str = Field(..., min_length=10, max_length=10000, description="Conteúdo do documento")
    category: str = Field(default="general", description="Categoria (general, faq, tutorial, etc)")

    model_config = {"from_attributes": True}


class KnowledgeBaseResponse(BaseModel):
    """Resposta de documento de conhecimento"""
    id: str
    title: str
    content: str
    category: str
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class SearchKnowledgeRequest(BaseModel):
    """Requisição de busca de conhecimento"""
    query: str = Field(..., min_length=3, max_length=500, description="Texto para buscar")
    limit: int = Field(default=5, ge=1, le=20, description="Número máximo de resultados")
    threshold: float = Field(default=0.5, ge=0.0, le=1.0, description="Threshold de similaridade (0-1)")

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    """Resultado de busca individual"""
    knowledge_id: str
    title: str
    content: str
    similarity: float = Field(description="Score de similaridade (0-1)")
    category: str

    model_config = {"from_attributes": True}


class SearchKnowledgeResponse(BaseModel):
    """Resposta de busca de conhecimento"""
    query: str
    results: list[SearchResult]
    total: int = Field(description="Total de resultados encontrados")

    model_config = {"from_attributes": True}
