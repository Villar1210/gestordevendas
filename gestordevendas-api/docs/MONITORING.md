# Monitoring & Alerting — Prometheus + Grafana

> **Fase 18: Observabilidade completa da plataforma**

---

## 📊 Stack de Monitoramento

```
Application → Prometheus → Grafana
                  ↓
         Alertmanager → Slack/Email/PagerDuty
```

---

## 🚀 Inicializar

```bash
# Incluir monitoring no docker-compose
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up

# Acessar
# Prometheus:    http://localhost:9090
# Grafana:       http://localhost:3000 (admin/admin)
# Alertmanager:  http://localhost:9093
```

---

## 📈 Métricas Coletadas

### Application Metrics

| Métrica | Tipo | Labels |
|---------|------|--------|
| `http_requests_total` | Counter | method, endpoint, status |
| `http_request_duration_seconds` | Histogram | method, endpoint |
| `errors_total` | Counter | error_type, endpoint |
| `cache_hits_total` | Counter | resource_type |
| `cache_misses_total` | Counter | resource_type |
| `audit_actions_total` | Counter | action, result |
| `database_queries_total` | Counter | operation, table |
| `database_query_duration_seconds` | Histogram | operation, table |

### Infrastructure Metrics

- CPU usage (%)
- Memory usage (bytes)
- Disk space (bytes)
- Network I/O
- Docker container stats

### Database Metrics

- Conexões ativas
- Queries por segundo
- Latência de queries
- Size do banco

### Cache Metrics

- Hit/miss rate
- Redis memory
- Connected clients

---

## 🔔 Alertas Configurados

### 🔴 CRITICAL (Pagerduty + Slack + Email)

- `DatabaseDown` — PostgreSQL não respondendo
- `BackendDown` — API não respondendo
- `RedisDown` — Cache indisponível
- `CriticalErrorRate` — >10% de erros
- `CriticalLatency` — P95 > 5s
- `CriticalMemoryUsage` — >6GB

### 🟡 WARNING (Slack + Email)

- `HighErrorRate` — >5% erros
- `HighLatency` — P95 > 1s
- `SlowDatabaseQueries` — P95 > 500ms
- `LowCacheHitRate` — <50%
- `HighMemoryUsage` — >3GB
- `HighCPUUsage` — >80%
- `DiskSpaceRunningOut` — <10% livre

---

## 🎨 Dashboards Grafana

### Dashboard: deskcomm-main
- Overview de saúde
- Taxa de erro
- Latência (P50/P95/P99)
- Cache hit rate
- Resource usage

### Dashboard: deskcomm-database
- Queries/segundo
- Latência por operação
- Conexões ativas
- Slow queries
- Table sizes

### Dashboard: deskcomm-infrastructure
- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- Container stats

### Dashboard: deskcomm-business
- Requisições por endpoint
- Ações auditadas
- Erros por tipo
- Taxa de sucesso por ação

---

## 💻 Integração no Código

### Middleware Automático

```python
from app.core.metrics import MetricsMiddleware

app.add_middleware(MetricsMiddleware)

# Automático para todas as requisições
```

### Recording Manual

```python
from app.core.metrics import MetricsRecorder

# HTTP
MetricsRecorder.record_http_request(
    method="GET",
    endpoint="/api/leads",
    status=200,
    duration=0.125
)

# Database
MetricsRecorder.record_database_query(
    operation="select",
    table="leads",
    duration=0.050
)

# Cache
MetricsRecorder.record_cache_hit("contact", 0.005)
```

### Context Manager para Timing

```python
from app.core.metrics import TimerContext, MetricsRecorder

with TimerContext(lambda d: MetricsRecorder.record_database_query("select", "leads", d)):
    # Código a medir
    results = db.query(Lead).all()
```

---

## 🔧 Configuração

### .env.production

```env
# Monitoramento
PROMETHEUS_RETENTION_DAYS=30
GRAFANA_PASSWORD=seu-senha-segura
ALERT_EMAIL=ops@ivillar.com.br

# Alertas Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Alertas Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@ivillar.com.br
SMTP_PASSWORD=sua-senha

# PagerDuty (opcional)
PAGERDUTY_SERVICE_KEY=sua-chave
```

---

## 📊 PromQL Queries Úteis

### Taxa de erro atual
```promql
sum(rate(errors_total[5m])) / sum(rate(http_requests_total[5m]))
```

### P95 latência
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Cache hit rate
```promql
sum(rate(cache_hits_total[5m])) / 
(sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

### Queries lentas por table
```promql
histogram_quantile(0.95, rate(database_query_duration_seconds_bucket{operation="select"}[5m]))
  by (table)
```

### Memory usage
```promql
memory_usage_bytes / 1073741824  # em GB
```

---

## 🧪 Testes

```bash
pytest tests/core/test_metrics_monitoring.py -v
```

---

## 📋 Checklist

- [ ] Docker Compose monitoring iniciado
- [ ] Prometheus scrapeando métricas
- [ ] Grafana dashboards criados
- [ ] Alertas configurados
- [ ] Slack/Email integrados
- [ ] Testes passando
- [ ] Retenção de dados configurada (30 dias)
- [ ] Backup automático ativo

---

**Versão:** 1.0.0  
**Status:** Production Ready  
**Alert Latency Target:** <1 minuto
