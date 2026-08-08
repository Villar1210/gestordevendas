# 🔥 Load Testing Plan

> **Objetivo:** Validar performance e capacidade sob carga

---

## 📊 CENÁRIOS DE TESTE

### Cenário 1: Carga Normal (Baseline)
- **Usuários:** 10
- **Taxa:** 1 req/segundo
- **Duração:** 5 minutos
- **Esperado:** P95 < 500ms, 0% errors

### Cenário 2: Carga Média
- **Usuários:** 50
- **Taxa:** 5 req/segundo
- **Duração:** 10 minutos
- **Esperado:** P95 < 1000ms, < 0.1% errors

### Cenário 3: Carga Alta
- **Usuários:** 100
- **Taxa:** 10 req/segundo
- **Duração:** 15 minutos
- **Esperado:** P95 < 2000ms, < 1% errors

### Cenário 4: Pico (Stress Test)
- **Usuários:** 500
- **Taxa:** 50 req/segundo
- **Duração:** 5 minutos
- **Esperado:** Sistema não quebra, recovery rápido

---

## 🧪 TESTE DE JORNADA DO USUÁRIO

### Fluxo 1: Login + Browse Leads
```
1. GET /api/health (setup)
2. POST /auth/login (1 vez por usuário)
3. GET /api/leads (a cada 5s)
4. GET /api/leads/{id} (a cada 10s)
5. Repeat por 5 min
```

### Fluxo 2: Create Lead
```
1. POST /auth/login (setup)
2. POST /api/leads (nova lead)
3. GET /api/leads (verificar)
4. PUT /api/leads/{id} (update)
5. Repeat
```

### Fluxo 3: Real-time Updates
```
1. POST /auth/login
2. GET /api/leads
3. WebSocket connect /ws/leads
4. Listen for updates
5. POST /api/leads (trigger update)
6. Verify live update
```

---

## 📈 MÉTRICAS A COLETAR

### Latência
- [ ] Response Time (min, max, avg)
- [ ] P50, P95, P99 latency
- [ ] Percentile breakdown

### Throughput
- [ ] Requests/second
- [ ] Bytes/second
- [ ] Connections/second

### Erros
- [ ] Error rate (%)
- [ ] Error types (4xx, 5xx)
- [ ] Failed requests

### Recursos
- [ ] CPU usage
- [ ] Memory usage
- [ ] Disk I/O
- [ ] Network I/O

### Cache
- [ ] Hit rate (%)
- [ ] Miss rate (%)
- [ ] Evictions

### Database
- [ ] Query latency
- [ ] Connections active
- [ ] Slow queries

---

## 🛠️ FERRAMENTAS

### Apache JMeter
```bash
# Instalar
brew install jmeter

# Rodar teste
jmeter -n -t tests/load/scenario.jmx -l results.jtl

# Ver relatório
jmeter -g results.jtl -o report
```

### Locust (Python)
```bash
# Instalar
pip install locust

# Rodar
locust -f tests/load/locustfile.py --host=http://localhost:8000 -u 100 -r 10

# Com arquivo de configuração
locust -f tests/load/locustfile.py -c 100 -r 10 --run-time 10m
```

### k6 (Moderno)
```bash
# Instalar
brew install k6

# Rodar
k6 run tests/load/scenario.js

# Com thresholds
k6 run tests/load/scenario.js --duration 5m --vus 100
```

---

## 📋 RESULTADOS ESPERADOS

### Sucesso (Verde)
```
✅ P95 latency < 1000ms
✅ Error rate < 0.5%
✅ CPU usage < 70%
✅ Memory usage < 80%
✅ Cache hit rate > 80%
```

### Aviso (Amarelo)
```
⚠️ P95 latency 1000-2000ms
⚠️ Error rate 0.5-1%
⚠️ CPU usage 70-85%
⚠️ Memory usage 80-90%
```

### Crítico (Vermelho)
```
❌ P95 latency > 2000ms
❌ Error rate > 1%
❌ CPU usage > 85%
❌ Memory usage > 90%
❌ Out of memory
```

---

## 🔍 ANÁLISE DE RESULTADOS

### Se Sucesso
```
→ Continue para Security Audit
→ Prepare production deployment
```

### Se Aviso
```
→ Identificar gargalo
→ Otimizar (cache, índices, etc)
→ Retry teste
```

### Se Crítico
```
→ Parar testes
→ Investigar root cause
→ Fixar antes de continuar
```

---

## 📊 EXEMPLO DE RELATÓRIO

```
LOAD TEST REPORT
═════════════════════════════════════════════

Test Duration: 15 minutes
Peak Load: 100 users
Requests: 90,000

Latency (ms):
  Min:     10
  Avg:    250
  P50:    200
  P95:    850
  P99:   1500
  Max:   3200

Throughput:
  Requests/sec: 100
  Bytes/sec: 2.5MB

Errors:
  Total: 450 (0.5%)
  4xx: 0
  5xx: 450 (connection timeouts)

Resources:
  CPU: 65%
  Memory: 2.8GB
  Disk I/O: 45%

Cache:
  Hit rate: 85%
  Misses: 15%

DATABASE:
  Avg query: 150ms
  P95 query: 500ms
  Active connections: 8

CONCLUSION:
✅ Performance is acceptable for production
⚠️  Monitor connection pool during peak hours
✅ Ready for production deployment
```

---

## ⚡ OTIMIZAÇÕES SE NECESSÁRIO

### Se latência alta
```
→ Aumentar cache TTL
→ Adicionar mais db indexes
→ Implementar query caching
→ Aumentar connection pool
```

### Se CPU alta
```
→ Aumentar workers (API)
→ Otimizar queries (EXPLAIN ANALYZE)
→ Usar read replicas para reports
→ Implementar rate limiting mais agressivo
```

### Se memory alta
```
→ Aumentar instance size
→ Reduzir cache TTL
→ Otimizar objetos grandes
→ Implementar pagination
```

---

## 📋 CHECKLIST

- [ ] Ferramentas instaladas
- [ ] Cenários definidos
- [ ] Staging environment ready
- [ ] Monitoring setup (Grafana)
- [ ] Baseline test (10 users)
- [ ] Medium load test (50 users)
- [ ] High load test (100 users)
- [ ] Stress test (500 users)
- [ ] Análise de resultados
- [ ] Otimizações (se necessário)
- [ ] Retry testes (se otimizado)
- [ ] Relatório final

---

**Tempo estimado:** 2-4 horas (completo)
**Responsável:** Performance Engineering
**Próximo passo:** Security Audit
