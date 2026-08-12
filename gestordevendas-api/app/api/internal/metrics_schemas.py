"""Schemas para Metrics Endpoints (Task 4)"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class KPIMetric(BaseModel):
    """Métrica de KPI individual"""
    metric_name: str = Field(description="Nome da métrica (total_leads, conversion_rate, etc)")
    metric_value: float = Field(description="Valor atual da métrica")
    previous_value: float = Field(description="Valor do período anterior")
    change_percent: float = Field(description="Percentual de mudança")

    model_config = {"from_attributes": True}


class KPIResponse(BaseModel):
    """Resposta de KPIs"""
    period_start: date
    period_end: date
    kpis: list[KPIMetric]
    summary: dict = Field(default_factory=dict, description="Resumo agregado")

    model_config = {"from_attributes": True}


class TrendData(BaseModel):
    """Ponto de dados de tendência"""
    date: date
    value: float
    metric_name: str

    model_config = {"from_attributes": True}


class TrendsResponse(BaseModel):
    """Resposta de tendências"""
    metric_name: str
    period_start: date
    period_end: date
    trends: list[TrendData]
    summary: dict = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class TeamMetric(BaseModel):
    """Métrica de membro da equipe"""
    user_id: str
    user_name: str
    total_leads: int
    total_won: int
    conversion_rate: float
    avg_deal_size: float

    model_config = {"from_attributes": True}


class TeamMetricsResponse(BaseModel):
    """Resposta de métricas de equipe"""
    period_start: date
    period_end: date
    team_members: list[TeamMetric]
    team_summary: dict = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class AnalyticsEventCreate(BaseModel):
    """Criar evento de analytics"""
    event_type: str = Field(..., description="Tipo de evento (card_created, card_won, etc)")
    event_value: float = Field(default=1.0, description="Valor do evento")
    metadata: Optional[dict] = Field(default=None, description="Metadados adicionais")

    model_config = {"from_attributes": True}
