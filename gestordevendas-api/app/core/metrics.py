"""
Prometheus Metrics - Application Monitoring

Métricas para Prometheus scraper.
"""

from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry
from typing import Optional
import time

# Registry global
REGISTRY = CollectorRegistry()

# ─── COUNTERS (incrementam só) ────────────────────────────────────────────

# Requisições HTTP
http_requests_total = Counter(
    "http_requests_total",
    "Total de requisições HTTP",
    ["method", "endpoint", "status"],
    registry=REGISTRY,
)

# Erros
errors_total = Counter(
    "errors_total",
    "Total de erros",
    ["error_type", "endpoint"],
    registry=REGISTRY,
)

# Ações auditadas
audit_actions_total = Counter(
    "audit_actions_total",
    "Total de ações auditadas",
    ["action", "result"],
    registry=REGISTRY,
)

# Database queries
database_queries_total = Counter(
    "database_queries_total",
    "Total de queries no banco",
    ["operation", "table"],
    registry=REGISTRY,
)

# Cache hits/misses
cache_hits_total = Counter(
    "cache_hits_total",
    "Total de cache hits",
    ["resource_type"],
    registry=REGISTRY,
)

cache_misses_total = Counter(
    "cache_misses_total",
    "Total de cache misses",
    ["resource_type"],
    registry=REGISTRY,
)

# ─── HISTOGRAMS (medem distribuição) ──────────────────────────────────────

# Latência de requisições
http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "Latência de requisições HTTP em segundos",
    ["method", "endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0),
    registry=REGISTRY,
)

# Latência de queries
database_query_duration_seconds = Histogram(
    "database_query_duration_seconds",
    "Latência de queries em segundos",
    ["operation", "table"],
    buckets=(0.001, 0.01, 0.05, 0.1, 0.5, 1.0),
    registry=REGISTRY,
)

# Latência de cache
cache_operation_duration_seconds = Histogram(
    "cache_operation_duration_seconds",
    "Latência de operações cache em segundos",
    ["operation"],
    buckets=(0.0001, 0.0005, 0.001, 0.005, 0.01),
    registry=REGISTRY,
)

# ─── GAUGES (valores pontuais) ────────────────────────────────────────────

# Conexões ativas
active_connections = Gauge(
    "active_connections",
    "Número de conexões ativas",
    registry=REGISTRY,
)

# Usuários online
active_users = Gauge(
    "active_users",
    "Número de usuários online",
    ["tenant_id"],
    registry=REGISTRY,
)

# Taxa de erro
error_rate = Gauge(
    "error_rate_percent",
    "Taxa de erro em porcentagem",
    registry=REGISTRY,
)

# Cache hit rate
cache_hit_rate = Gauge(
    "cache_hit_rate_percent",
    "Taxa de cache hits em porcentagem",
    registry=REGISTRY,
)

# Memory usage
memory_usage_bytes = Gauge(
    "memory_usage_bytes",
    "Uso de memória em bytes",
    registry=REGISTRY,
)

# Database connections
database_connections_active = Gauge(
    "database_connections_active",
    "Número de conexões ativas com banco",
    registry=REGISTRY,
)

# Queue size
background_jobs_queue_size = Gauge(
    "background_jobs_queue_size",
    "Tamanho da fila de jobs em background",
    registry=REGISTRY,
)


# ─── CONTEXT MANAGERS PARA INSTRUMENTAÇÃO ────────────────────────────────

class MetricsRecorder:
    """Context manager para gravar métricas."""

    @staticmethod
    def record_http_request(method: str, endpoint: str, status: int, duration: float):
        """Registrar requisição HTTP."""
        http_requests_total.labels(method=method, endpoint=endpoint, status=status).inc()
        http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)

    @staticmethod
    def record_error(error_type: str, endpoint: str):
        """Registrar erro."""
        errors_total.labels(error_type=error_type, endpoint=endpoint).inc()

    @staticmethod
    def record_audit_action(action: str, result: str):
        """Registrar ação auditada."""
        audit_actions_total.labels(action=action, result=result).inc()

    @staticmethod
    def record_database_query(operation: str, table: str, duration: float):
        """Registrar query de banco."""
        database_queries_total.labels(operation=operation, table=table).inc()
        database_query_duration_seconds.labels(operation=operation, table=table).observe(duration)

    @staticmethod
    def record_cache_hit(resource_type: str, duration: float):
        """Registrar cache hit."""
        cache_hits_total.labels(resource_type=resource_type).inc()
        cache_operation_duration_seconds.labels(operation="get").observe(duration)

    @staticmethod
    def record_cache_miss(resource_type: str):
        """Registrar cache miss."""
        cache_misses_total.labels(resource_type=resource_type).inc()

    @staticmethod
    def set_active_connections(count: int):
        """Atualizar conexões ativas."""
        active_connections.set(count)

    @staticmethod
    def set_active_users(tenant_id: str, count: int):
        """Atualizar usuários ativos."""
        active_users.labels(tenant_id=tenant_id).set(count)

    @staticmethod
    def set_error_rate(rate_percent: float):
        """Atualizar taxa de erro."""
        error_rate.set(rate_percent)

    @staticmethod
    def set_cache_hit_rate(rate_percent: float):
        """Atualizar taxa de cache hits."""
        cache_hit_rate.set(rate_percent)

    @staticmethod
    def set_memory_usage(bytes_used: int):
        """Atualizar uso de memória."""
        memory_usage_bytes.set(bytes_used)

    @staticmethod
    def set_database_connections(count: int):
        """Atualizar conexões de banco."""
        database_connections_active.set(count)

    @staticmethod
    def set_queue_size(size: int):
        """Atualizar tamanho da fila."""
        background_jobs_queue_size.set(size)


class TimerContext:
    """Context manager para medir tempo."""

    def __init__(self, record_func):
        self.record_func = record_func
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        self.record_func(duration)


# ─── MIDDLEWARE PARA INSTRUMENTAÇÃO AUTOMÁTICA ────────────────────────────

from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
import re


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware que registra métricas de requisições."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        # Normalizar endpoint (remover IDs)
        endpoint = request.url.path
        endpoint = re.sub(r'/[0-9a-f-]{36}', '/{id}', endpoint)  # UUID
        endpoint = re.sub(r'/[0-9]+', '/{id}', endpoint)  # Números

        try:
            response = await call_next(request)

            duration = time.time() - start_time
            MetricsRecorder.record_http_request(
                method=request.method,
                endpoint=endpoint,
                status=response.status_code,
                duration=duration,
            )

            # Adicionar header com latência
            response.headers["X-Response-Time"] = str(duration)

            return response

        except Exception as exc:
            MetricsRecorder.record_error(
                error_type=type(exc).__name__,
                endpoint=endpoint,
            )
            raise


# ─── TASK PERIODIC PARA ATUALIZAR GAUGES ─────────────────────────────────

async def update_metrics_periodic():
    """
    Atualizar métricas que não são incrementais.
    Executar a cada 30 segundos via APScheduler.
    """
    import os
    import psutil

    # Memory usage
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    MetricsRecorder.set_memory_usage(memory_info.rss)

    # Usuários ativos (exemplo)
    # Implementar query real para contar usuários online por tenant
    # MetricsRecorder.set_active_users("tenant-1", 5)

    # Cache hit rate (do cache_stats do core/cache.py)
    from app.core.cache import cache_stats
    MetricsRecorder.set_cache_hit_rate(cache_stats.hit_rate)

    # Database connections (do pool de conexões)
    # Implementar query real ao banco
    # MetricsRecorder.set_database_connections(5)
