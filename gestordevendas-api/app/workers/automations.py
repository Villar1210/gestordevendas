"""
Tarefas Celery: execução de automações.
Implementação completa na Fase 4.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name="app.workers.automations.execute_automation",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="automations",
)
def execute_automation(self, automation_id: str, entity_id: str, account_id: str, event_type: str):
    """
    Executa uma automação de forma assíncrona.
    Fase 4: implementar motor de avaliação de condições e ações.
    """
    logger.info(f"[Automation] automation_id={automation_id} event={event_type}")
    # TODO Fase 4: implementar execução real
    raise NotImplementedError("Fase 4 — a implementar")


@shared_task(
    name="app.workers.automations.retry_pending_automations",
    queue="automations",
)
def retry_pending_automations():
    """
    Cron task: retentar automações com falha pendentes.
    Fase 4: implementar consulta a automation_pending_executions.
    """
    logger.info("[Automation] Verificando execuções pendentes...")
    # TODO Fase 4: implementar retry das pendentes
