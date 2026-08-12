"""Endpoints para Metrics (Task 4)"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import date
from app.api.internal.metrics_schemas import KPIResponse, TrendsResponse, TeamMetricsResponse
from app.core.auth import get_current_user
from app.application.metrics.use_cases import (
    CalculateKPIsUseCase,
    GetTrendsUseCase,
    GetTeamMetricsUseCase,
)
from app.infra.supabase.metrics_repository import MetricsRepository
from app.core.supabase import get_supabase

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("/kpi", status_code=200)
async def get_kpis(
    start_date: date = Query(..., description="Data inicial (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Data final (YYYY-MM-DD)"),
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Obter KPIs para um período"""
    try:
        repository = MetricsRepository(supabase)
        use_case = CalculateKPIsUseCase(repository)

        result = await use_case.execute(
            account_id=user.get("account_id"),
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "period_start": start_date,
            "period_end": end_date,
            "kpis": result.get("kpis", []),
            "summary": {"total_kpis": len(result.get("kpis", []))},
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating KPIs: {str(e)}")


@router.get("/trends/{event_type}", status_code=200)
async def get_trends(
    event_type: str,
    start_date: date = Query(..., description="Data inicial (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Data final (YYYY-MM-DD)"),
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Obter tendências para um tipo de evento"""
    try:
        repository = MetricsRepository(supabase)
        use_case = GetTrendsUseCase(repository)

        result = await use_case.execute(
            account_id=user.get("account_id"),
            event_type=event_type,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "metric_name": event_type,
            "period_start": start_date,
            "period_end": end_date,
            "trends": result.get("trends", []),
            "summary": {"total_points": len(result.get("trends", []))},
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting trends: {str(e)}")


@router.get("/team", status_code=200)
async def get_team_metrics(
    start_date: date = Query(..., description="Data inicial (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Data final (YYYY-MM-DD)"),
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Obter métricas da equipe"""
    try:
        repository = MetricsRepository(supabase)
        use_case = GetTeamMetricsUseCase(repository)

        result = await use_case.execute(
            account_id=user.get("account_id"),
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "period_start": start_date,
            "period_end": end_date,
            "team_members": result.get("team_members", []),
            "team_summary": {
                "team_size": result.get("team_size", 0),
                "total_members": len(result.get("team_members", [])),
            },
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting team metrics: {str(e)}")
