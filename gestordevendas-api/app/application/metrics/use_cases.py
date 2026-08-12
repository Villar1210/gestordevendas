"""Use cases para Metrics Endpoints (Task 4)"""
from datetime import date, timedelta
from app.infra.supabase.metrics_repository import MetricsRepository


class CalculateKPIsUseCase:
    """Calcular KPIs para um período"""

    def __init__(self, repository: MetricsRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        start_date: date,
        end_date: date,
    ):
        """Calcular KPIs"""
        if start_date > end_date:
            raise ValueError("Start date must be before end date")

        kpis = await self.repository.get_kpis(
            account_id=account_id,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "kpis": kpis,
            "period": {"start": start_date, "end": end_date},
        }


class GetTrendsUseCase:
    """Obter tendências para um tipo de evento"""

    def __init__(self, repository: MetricsRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        event_type: str,
        start_date: date,
        end_date: date,
    ):
        """Obter tendências"""
        if not event_type:
            raise ValueError("Event type is required")

        if start_date > end_date:
            raise ValueError("Start date must be before end date")

        trends = await self.repository.get_trends(
            account_id=account_id,
            event_type=event_type,
            start_date=start_date,
            end_date=end_date,
        )

        # Agregar por data
        daily_totals = {}
        for trend in trends:
            date_key = str(trend.get("event_date"))
            if date_key not in daily_totals:
                daily_totals[date_key] = 0
            daily_totals[date_key] += trend.get("event_value", 0)

        return {
            "event_type": event_type,
            "trends": [
                {"date": date_key, "value": value}
                for date_key, value in sorted(daily_totals.items())
            ],
            "period": {"start": start_date, "end": end_date},
        }


class GetTeamMetricsUseCase:
    """Obter métricas da equipe"""

    def __init__(self, repository: MetricsRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        start_date: date,
        end_date: date,
    ):
        """Obter métricas por membro da equipe"""
        if start_date > end_date:
            raise ValueError("Start date must be before end date")

        events = await self.repository.get_team_metrics(
            account_id=account_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Agregar por usuário
        user_metrics = {}
        for event in events:
            user_id = str(event.get("user_id", "unknown"))
            if user_id not in user_metrics:
                user_metrics[user_id] = {
                    "user_id": user_id,
                    "total_events": 0,
                    "total_value": 0,
                }
            user_metrics[user_id]["total_events"] += 1
            user_metrics[user_id]["total_value"] += event.get("event_value", 0)

        return {
            "team_members": list(user_metrics.values()),
            "period": {"start": start_date, "end": end_date},
            "team_size": len(user_metrics),
        }


class RecordAnalyticsEventUseCase:
    """Registrar evento de analytics"""

    def __init__(self, repository: MetricsRepository):
        self.repository = repository

    async def execute(
        self,
        account_id: str,
        user_id: str,
        event_type: str,
        event_value: float = 1.0,
        metadata: dict = None,
    ):
        """Registrar evento"""
        if not event_type:
            raise ValueError("Event type is required")

        if event_value <= 0:
            raise ValueError("Event value must be positive")

        event = await self.repository.create_analytics_event(
            account_id=account_id,
            user_id=user_id,
            event_type=event_type,
            event_value=event_value,
            metadata=metadata,
        )

        if not event:
            raise ValueError("Failed to record event")

        return event
