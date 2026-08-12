"""Repository para Metrics e Analytics"""
from typing import Optional
from datetime import date


class MetricsRepository:
    """Gerenciar métricas e eventos de analytics"""

    def __init__(self, supabase):
        self.supabase = supabase

    async def create_analytics_event(
        self,
        account_id: str,
        user_id: Optional[str],
        event_type: str,
        event_value: float = 1.0,
        metadata: Optional[dict] = None,
    ) -> dict:
        """Criar evento de analytics"""
        result = await self.supabase.table("analytics_events").insert({
            "account_id": account_id,
            "user_id": user_id,
            "event_type": event_type,
            "event_value": event_value,
            "metadata": metadata or {},
        }).execute()

        return result.data[0] if result.data else None

    async def get_kpis(
        self,
        account_id: str,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Calcular KPIs para um período"""
        result = await self.supabase.rpc(
            "calculate_kpis",
            {
                "p_account_id": account_id,
                "p_start_date": start_date.isoformat(),
                "p_end_date": end_date.isoformat(),
            },
        ).execute()

        return result.data if result.data else []

    async def get_trends(
        self,
        account_id: str,
        event_type: str,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Obter tendências de um tipo de evento"""
        result = await self.supabase.table("analytics_events").select(
            "event_date, event_value"
        ).eq("account_id", account_id).eq("event_type", event_type).gte(
            "event_date", f"{start_date}T00:00:00"
        ).lte(
            "event_date", f"{end_date}T23:59:59"
        ).order("event_date").execute()

        return result.data if result.data else []

    async def get_team_metrics(
        self,
        account_id: str,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Obter métricas por membro da equipe"""
        result = await self.supabase.table("analytics_events").select(
            "user_id, event_type, event_value"
        ).eq("account_id", account_id).gte(
            "event_date", f"{start_date}T00:00:00"
        ).lte(
            "event_date", f"{end_date}T23:59:59"
        ).execute()

        return result.data if result.data else []

    async def get_daily_summary(
        self,
        account_id: str,
        summary_date: date,
    ) -> Optional[dict]:
        """Obter resumo diário pré-calculado"""
        result = await self.supabase.table("daily_summaries").select("*").eq(
            "account_id", account_id
        ).eq("summary_date", summary_date.isoformat()).execute()

        return result.data[0] if result.data else None

    async def update_daily_summary(
        self,
        account_id: str,
        summary_date: date,
        summary_data: dict,
    ) -> dict:
        """Atualizar ou criar resumo diário"""
        result = await self.supabase.table("daily_summaries").upsert({
            "account_id": account_id,
            "summary_date": summary_date.isoformat(),
            **summary_data,
        }, on_conflict="account_id,summary_date").execute()

        return result.data[0] if result.data else None

    async def create_metric(
        self,
        account_id: str,
        metric_type: str,
        metric_name: str,
        metric_value: float,
        period_start: date,
        period_end: date,
        dimensions: Optional[dict] = None,
    ) -> dict:
        """Criar métrica armazenada"""
        result = await self.supabase.table("metrics").insert({
            "account_id": account_id,
            "metric_type": metric_type,
            "metric_name": metric_name,
            "metric_value": metric_value,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "dimensions": dimensions or {},
        }).execute()

        return result.data[0] if result.data else None
