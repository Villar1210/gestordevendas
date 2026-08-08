"""
Configuração do Celery.

Filas:
  default     — tarefas gerais
  broadcasts  — envios em massa (alta concorrência, separado para não bloquear)
  automations — execução de automações e retries
  flows       — retomada de chatbot flows expirados
  embeddings  — reindexação de IA (CPU-intensivo, worker dedicado)
"""
from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

cfg = get_settings()

celery = Celery(
    "gestordevendas",
    broker=cfg.REDIS_URL,
    backend=cfg.REDIS_URL,
    include=[
        "app.workers.broadcast",
        "app.workers.automations",
        "app.workers.flows",
        "app.workers.embeddings",
    ],
)

celery.conf.update(
    # ── Serialização ────────────────────────────────────────────────────────
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,

    # ── Filas e roteamento ──────────────────────────────────────────────────
    task_default_queue="default",
    task_queues={
        "default":     {"exchange": "default",     "routing_key": "default"},
        "broadcasts":  {"exchange": "broadcasts",  "routing_key": "broadcasts"},
        "automations": {"exchange": "automations", "routing_key": "automations"},
        "flows":       {"exchange": "flows",       "routing_key": "flows"},
        "embeddings":  {"exchange": "embeddings",  "routing_key": "embeddings"},
    },
    task_routes={
        "app.workers.broadcast.*":   {"queue": "broadcasts"},
        "app.workers.automations.*": {"queue": "automations"},
        "app.workers.flows.*":       {"queue": "flows"},
        "app.workers.embeddings.*":  {"queue": "embeddings"},
    },

    # ── Retry defaults ──────────────────────────────────────────────────────
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_max_retries=3,

    # ── Resultado ───────────────────────────────────────────────────────────
    result_expires=3600,         # resultado expira em 1h

    # ── Beat Schedule (tarefas agendadas) ───────────────────────────────────
    beat_schedule={
        # Retoma flow_runs expirados a cada 5 minutos
        "resume-expired-flows": {
            "task": "app.workers.flows.resume_expired_flows",
            "schedule": crontab(minute="*/5"),
            "options": {"queue": "flows"},
        },
        # Retenta automações com falha a cada 10 minutos
        "retry-failed-automations": {
            "task": "app.workers.automations.retry_pending_automations",
            "schedule": crontab(minute="*/10"),
            "options": {"queue": "automations"},
        },
    },
)
