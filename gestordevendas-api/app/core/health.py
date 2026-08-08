"""
Health check detalhado — verifica Supabase, Redis e workers.
Usado pelo endpoint /health/detailed (não exposto publicamente em produção).
"""
from __future__ import annotations

import time
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


def _check_supabase() -> dict[str, Any]:
    start = time.perf_counter()
    try:
        from app.core.supabase import get_supabase_admin
        client = get_supabase_admin()
        # Query mínima — 1 linha de qualquer tabela do sistema
        client.table("accounts").select("id").limit(1).execute()
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "ok", "latency_ms": latency_ms}
    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "error", "latency_ms": latency_ms, "error": str(e)[:200]}


def _check_redis() -> dict[str, Any]:
    start = time.perf_counter()
    try:
        import redis
        from app.core.config import get_settings
        r = redis.from_url(get_settings().REDIS_URL, socket_connect_timeout=2)
        r.ping()
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "ok", "latency_ms": latency_ms}
    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "error", "latency_ms": latency_ms, "error": str(e)[:200]}


def _check_celery() -> dict[str, Any]:
    """Verifica se ao menos um worker Celery está respondendo."""
    try:
        from app.workers.celery_app import celery_app
        inspect = celery_app.control.inspect(timeout=2)
        stats = inspect.stats()
        if stats:
            worker_count = len(stats)
            return {"status": "ok", "workers": worker_count}
        return {"status": "no_workers", "workers": 0}
    except Exception as e:
        return {"status": "error", "error": str(e)[:200]}


def get_detailed_health() -> dict[str, Any]:
    """
    Executa todos os checks em sequência e retorna o resultado agregado.
    Status geral: 'healthy' só se todos os componentes críticos estiverem ok.
    """
    supabase = _check_supabase()
    redis = _check_redis()
    celery = _check_celery()

    # Supabase e Redis são críticos; Celery é degraded (não impede a API de funcionar)
    critical_ok = (
        supabase["status"] == "ok"
        and redis["status"] == "ok"
    )

    overall = "healthy" if critical_ok else "degraded"

    return {
        "status": overall,
        "service": "gestordevendas-api",
        "version": "1.0.0",
        "components": {
            "supabase": supabase,
            "redis": redis,
            "celery": celery,
        },
    }
