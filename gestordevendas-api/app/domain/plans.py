"""
Definição de planos SaaS e seus limites.

Cada plan define limites hard (erro 402 ao ultrapassar) e soft (aviso).
Plano "enterprise" não tem limites fixos — negociado caso a caso.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class PlanLimits:
    """Limites de uso por plano. None = ilimitado."""
    max_inboxes: Optional[int]           # contas WhatsApp conectadas
    max_contacts: Optional[int]          # contatos únicos
    max_agents: Optional[int]            # usuários com acesso ao dashboard
    max_conversations_per_month: Optional[int]
    max_broadcasts_per_month: Optional[int]
    max_kb_entries: Optional[int]        # entradas na knowledge base
    max_flows: Optional[int]             # chatbot flows ativos
    ai_enabled: bool                     # acesso à resposta automática AI
    broadcasts_enabled: bool
    flows_enabled: bool


PLANS: dict[str, PlanLimits] = {
    "free": PlanLimits(
        max_inboxes=1,
        max_contacts=500,
        max_agents=2,
        max_conversations_per_month=200,
        max_broadcasts_per_month=0,
        max_kb_entries=10,
        max_flows=2,
        ai_enabled=False,
        broadcasts_enabled=False,
        flows_enabled=True,
    ),
    "pro": PlanLimits(
        max_inboxes=3,
        max_contacts=5_000,
        max_agents=10,
        max_conversations_per_month=2_000,
        max_broadcasts_per_month=10,
        max_kb_entries=200,
        max_flows=20,
        ai_enabled=True,
        broadcasts_enabled=True,
        flows_enabled=True,
    ),
    "enterprise": PlanLimits(
        max_inboxes=None,
        max_contacts=None,
        max_agents=None,
        max_conversations_per_month=None,
        max_broadcasts_per_month=None,
        max_kb_entries=None,
        max_flows=None,
        ai_enabled=True,
        broadcasts_enabled=True,
        flows_enabled=True,
    ),
}

DEFAULT_PLAN = "free"


def get_plan(plan_name: str) -> PlanLimits:
    return PLANS.get(plan_name, PLANS[DEFAULT_PLAN])
