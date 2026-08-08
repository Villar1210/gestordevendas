# 🎯 Staging Deployment Plan

> **Objetivo:** Validar a plataforma em um ambiente de staging antes de produção

---

## 📋 PRÉ-REQUISITOS STAGING

### Servidor
- [ ] Ubuntu 20.04+ ou compatível
- [ ] 4GB RAM mínimo
- [ ] 2 cores CPU
- [ ] 20GB storage
- [ ] SSH acesso

### Software
- [ ] Docker 20.10+
- [ ] Docker Compose 1.29+
- [ ] Git
- [ ] Nginx (opcional, pode usar Docker)

### Configuração de Rede
- [ ] Domínio: staging-api.ivillar.com.br (apontando para IP)
- [ ] Firewall: portas 80, 443 abertas
- [ ] SSL: Let's Encrypt preparado

---

## 📊 CHECKLIST DE DEPLOY STAGING

### 1️⃣ PRÉ-DEPLOY
- [ ] Backup do ambiente atual (se existir)
- [ ] Verificar espaço em disco
- [ ] Verificar conexão de rede
- [ ] Verificar permissões SSH

### 2️⃣ CLONE & SETUP
- [ ] Clone repositório
- [ ] Configure .env.staging
- [ ] Configure docker-compose.yml
- [ ] Build Docker images

### 3️⃣ START SERVICES
- [ ] Start PostgreSQL + Redis
- [ ] Start API
- [ ] Start Monitoring stack
- [ ] Verificar health checks

### 4️⃣ SMOKE TESTS
- [ ] Health check: /api/health
- [ ] Login: POST /auth/login
- [ ] Criar lead: POST /api/leads
- [ ] Listar contacts: GET /api/contacts

### 5️⃣ MONITORING
- [ ] Prometheus scraping
- [ ] Grafana dashboards
- [ ] Alertas funcionando
- [ ] Logs estruturados

### 6️⃣ PERFORMANCE
- [ ] Latência P95 < 1s
- [ ] Cache hit rate > 80%
- [ ] Zero errors no primeiro deploy

### 7️⃣ VALIDAÇÃO FINAL
- [ ] Todas as suites de testes
- [ ] Cobertura de código
- [ ] Documentação atualizada

---

## 🔧 SCRIPTS DE DEPLOY

### Script 1: Setup Inicial
```bash
#!/bin/bash
set -e

echo "🚀 Staging Deployment Started..."

# Clone
cd /opt
git clone https://github.com/seu-org/deskcomm.git
cd deskcomm

# Setup env
cp .env.example .env.staging
# EDITAR .env.staging com valores de staging

# Build images
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml build

# Start
docker-compose up -d

# Wait for services
sleep 15

# Health check
curl http://localhost:8000/api/health || exit 1

echo "✅ Staging deployed successfully"
```

### Script 2: Post-Deploy Validation
```bash
#!/bin/bash

echo "🧪 Running Post-Deploy Validation..."

# Database migrations
docker-compose exec -T api alembic upgrade head

# Seed data
docker-compose exec -T api python -m app.scripts.seed_super_user

# Run smoke tests
pytest tests/smoke/ -v --base-url=http://localhost:8000

# Check monitoring
curl http://localhost:9090/api/v1/targets
curl http://localhost:3000/api/health

echo "✅ Validation complete"
```

---

## 📊 ESPERADO EM STAGING

### APIs Funcionando
```
✅ GET /api/health → 200
✅ POST /auth/login → 200
✅ GET /api/contacts → 200
✅ POST /api/leads → 201
✅ GET /metrics → 200
```

### Monitoring
```
✅ Prometheus: http://localhost:9090
✅ Grafana: http://localhost:3000
✅ Alertmanager: http://localhost:9093
```

### Performance
```
✅ API Latency P95: < 1000ms
✅ Cache Hit Rate: > 80%
✅ Database Latency: < 500ms
✅ Error Rate: < 0.1%
```

### Segurança
```
✅ HTTPS/SSL funcionando
✅ Rate limiting ativo
✅ Audit logging ativo
✅ Encryption de PII ativa
```

---

## 🧪 TESTES EM STAGING

### Smoke Tests (15 min)
```bash
pytest tests/smoke/ -v --base-url=https://staging-api.ivillar.com.br
```

### Integration Tests (30 min)
```bash
pytest tests/integration/ -v --base-url=https://staging-api.ivillar.com.br
```

### Load Testing (1 hour) - OPCIONAL
```bash
# 100 concurrent users
locust -f tests/load/locustfile.py --host=https://staging-api.ivillar.com.br -u 100 -r 10
```

---

## 📈 MÉTRICAS A MONITORAR

```
Durante os testes de staging:

✅ Latência:
   - P50: < 100ms
   - P95: < 1000ms
   - P99: < 2000ms

✅ Throughput:
   - Requests/sec: > 100
   - Errors/sec: < 1

✅ Recursos:
   - CPU: < 70%
   - Memory: < 3GB
   - Disk: > 50% livre

✅ Cache:
   - Hit rate: > 80%
   - Miss rate: < 20%
```

---

## ✅ CRITÉRIO DE SUCESSO STAGING

- [ ] 100% smoke tests passando
- [ ] 95%+ integration tests passando
- [ ] P95 latência < 1s
- [ ] Cache hit rate > 80%
- [ ] Zero security issues
- [ ] Monitoring alertas funcionando
- [ ] Logs estruturados coletando

**SE TODOS OS CRITÉRIOS OK → PRONTO PARA PRODUÇÃO**

---

## ⚠️ TROUBLESHOOTING

### Problema: Containers não iniciam
```bash
docker-compose logs -f api
# Verificar logs
```

### Problema: Health check falha
```bash
curl -v http://localhost:8000/api/health
# Verificar resposta
```

### Problema: Testes falhando
```bash
pytest tests/smoke/ -v -s
# Ver output detalhado
```

### Problema: Performance ruim
```bash
docker stats
# Ver uso de recursos
curl http://localhost:9090/api/v1/query?query=http_request_duration_seconds
# Ver métricas
```

---

## 🚀 PRÓXIMO PASSO

Após validação bem-sucedida em staging:

```
Staging ✅ → Load Testing → Security Audit → Production
```

---

**Status:** Ready for staging deployment
**Tempo estimado:** 1-2 horas (completo)
**Responsável:** DevOps/Platform Team
