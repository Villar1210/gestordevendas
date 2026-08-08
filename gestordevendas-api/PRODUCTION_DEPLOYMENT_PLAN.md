# 🚀 Production Deployment Plan

> **Objetivo:** Deploy da plataforma em produção com zero-downtime

---

## 📋 PRÉ-REQUISITOS PRODUÇÃO

### Servidor
- [ ] Ubuntu 20.04+ LTS
- [ ] 8GB RAM (mínimo 4GB)
- [ ] 4 cores CPU
- [ ] 100GB storage (SSD)
- [ ] Dedicated IP stático
- [ ] SSH access via chaves (não password)

### Domínio & SSL
- [ ] Domínio: ivillar.com.br
- [ ] DNS apontando para VPS
- [ ] SSL certificate (Let's Encrypt)
- [ ] CDN (CloudFlare) - opcional

### Backups
- [ ] Backup strategy definida
- [ ] Teste de restore
- [ ] Backup externo (S3)

### Monitoramento
- [ ] Prometheus rodando
- [ ] Grafana dashboards criados
- [ ] Alertas configurados
- [ ] Slack/Email integrado

### Segurança
- [ ] Firewall configurado (iptables/ufw)
- [ ] SSH hardened (chaves, not password)
- [ ] Secrets em environment (não hardcoded)
- [ ] Security audit passado

---

## 📊 TIMELINE DE DEPLOYMENT

### T-1 day (1 dia antes)
- [ ] Comunicação ao time
- [ ] Plano de rollback review
- [ ] Notification channels teste
- [ ] Final checks

### T (dia do deploy)
- [ ] Backup pré-deploy
- [ ] Health check staging
- [ ] Deploy script dry-run
- [ ] Real deploy
- [ ] Health check produção
- [ ] Smoke tests

### T+1h (1 hora depois)
- [ ] Monitoramento ativo
- [ ] User testing
- [ ] Performance check
- [ ] Error rate check

### T+24h (1 dia depois)
- [ ] Performance stable
- [ ] Zero critical issues
- [ ] Logs estruturados
- [ ] Backup verificado

---

## 🔧 DEPLOYMENT STEPS

### Step 1: Pré-Deploy
```bash
# Backup
./scripts/backup.sh full

# Health check staging
curl https://staging-api.ivillar.com.br/api/health

# Dry-run
./scripts/deploy.sh --dry-run

# Notificar time
curl -X POST https://hooks.slack.com/... -d "Deploy starting..."
```

### Step 2: Deploy Produção
```bash
# SSH para VPS
ssh deploy@api.ivillar.com.br

# Navegar para app
cd /opt/deskcomm

# Usar script de deploy
./scripts/deploy.sh --production

# Monitorar
docker-compose logs -f api

# Health check
curl https://api.ivillar.com.br/api/health
```

### Step 3: Pós-Deploy
```bash
# Rodar smoke tests
pytest tests/smoke/ -v --base-url=https://api.ivillar.com.br

# Verificar monitoring
open https://grafana.ivillar.com.br

# Verificar alertas
# (nenhum alerta crítico esperado)

# Teste de usuário
# Login com conta de teste
```

---

## 🔄 ZERO-DOWNTIME STRATEGY

### Blue-Green Deployment
```
Blue (Atual) ←→ Load Balancer ←→ Green (Novo)
                ↓
         Tráfego rota para Blue
         
1. Deploy Green (sem tráfego)
2. Health check Green
3. Switch tráfego para Green
4. Manter Blue como rollback
5. Cleanup Blue
```

### Rolling Deployment (Com Nginx)
```
1. API 1 ← rodando (100% tráfego)
2. API 2 ← deploy novo
3. Nginx tira API 1 do balanceamento
4. Aguarda conexões finalizarem
5. Atualiza API 1
6. Nginx volta API 1
7. Repeat para API 2
```

---

## 📊 HEALTH CHECK PRODUÇÃO

```bash
#!/bin/bash

echo "🏥 Production Health Check"

# API
if curl -s https://api.ivillar.com.br/api/health | grep -q '"status":"ok"'; then
    echo "✅ API: OK"
else
    echo "❌ API: FAILED"
    exit 1
fi

# Database
docker exec deskcomm_postgres pg_isready -U deskcomm
echo "✅ Database: OK"

# Redis
docker exec deskcomm_redis redis-cli ping | grep -q PONG
echo "✅ Cache: OK"

# Monitoring
curl -s https://prometheus.ivillar.com.br/-/healthy | grep -q "Prometheus Server is Healthy"
echo "✅ Prometheus: OK"

# Grafana
curl -s https://grafana.ivillar.com.br/api/health | grep -q '"status":"ok"'
echo "✅ Grafana: OK"

echo ""
echo "✅ ALL SYSTEMS OK - READY FOR TRAFFIC"
```

---

## 🚨 ROLLBACK PLAN

### Se erro detectado (< 30 minutos)
```bash
# Opção 1: Revert via git
git revert HEAD
docker-compose up -d --build

# Opção 2: Restore backup
./scripts/restore-backup.sh backup_20260808_150000.sql.gz

# Opção 3: Switch para Blue
nginx -s reload # (blue-green)

# Notificar
curl -X POST $SLACK_WEBHOOK -d "ROLLBACK EXECUTED"
```

### Se erro detectado (> 30 minutos)
```
→ Investigar erro antes de rollback
→ Hotfix se possível
→ Ou rollback se não
→ Post-mortem com time
```

---

## 📈 MONITORAMENTO PRODUÇÃO

### Primeira hora
- [ ] Latência P95 < 1s
- [ ] Error rate < 0.1%
- [ ] CPU < 50%
- [ ] Memory < 50%
- [ ] Cache hit rate > 80%
- [ ] Sem alertas críticos

### Primeiras 24h
- [ ] Todos os critérios acima
- [ ] Sem problemas intermitentes
- [ ] Logs estruturados
- [ ] Backup automático funcionando

### Primeira semana
- [ ] Performance estável
- [ ] Zero critical issues
- [ ] Usuários satisfeitos
- [ ] Load pattern normal

---

## 📝 CHECKLIST PRÉ-DEPLOY

- [ ] Code review completed
- [ ] Security audit passed
- [ ] Load testing passed
- [ ] Staging deployment passed
- [ ] Database backup taken
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Monitoring ready
- [ ] Alerts configured
- [ ] Logs checked

---

## ✅ CHECKLIST APÓS DEPLOY

### Imediato (0-15 min)
- [ ] API respondendo
- [ ] Database conectado
- [ ] Cache funcionando
- [ ] Nenhum erro 5xx
- [ ] Latência normal

### Curto prazo (15 min - 1h)
- [ ] Smoke tests passando
- [ ] Usuários podem fazer login
- [ ] Dados sendo criados/atualizados
- [ ] Monitoring enviando dados
- [ ] Alertas funcionando

### Médio prazo (1h - 24h)
- [ ] Performance estável
- [ ] Sem crescimento anômalo de errors
- [ ] Cache hit rate saudável
- [ ] Nenhum memory leak
- [ ] Backups funcionando

---

## 📊 MÉTRICAS DE SUCESSO

```
PRODUÇÃO LIVE CHECKLIST:

✅ API Health
   - Response time P95 < 1000ms
   - Error rate < 0.5%
   - Availability > 99.9%

✅ Database
   - Query latency P95 < 500ms
   - Connections < 20
   - Replication lag < 1s

✅ Cache
   - Hit rate > 80%
   - Memory usage < 2GB
   - Eviction rate < 1%

✅ Infrastructure
   - CPU usage < 60%
   - Memory usage < 70%
   - Disk usage < 50%
   - Network latency < 50ms

✅ Security
   - HTTPS/TLS working
   - Rate limiting active
   - Audit logging active
   - No security alerts

✅ Monitoring
   - Prometheus scraping
   - Grafana dashboards live
   - Alerts firing correctly
   - Logs aggregated
```

---

## 🎉 GO-LIVE CEREMONY

```
Quando tudo está OK:

1. Comunicar ao time de produto
   → "DESKCOMM is live in production"

2. Notify customers
   → Email to stakeholders

3. Monitor ativamente
   → Team on-call for 24h

4. Celebrate 🎉
   → Você conquistou!
```

---

## 📞 SUPPORT 24/7

### Escalation Path
```
Issue detected
    ↓
Alert fires (Slack notification)
    ↓
On-call engineer investigates
    ↓
If minor fix: Apply hotfix
If major issue: Trigger rollback
    ↓
Post-mortem within 24h
```

### On-Call Schedule
- [ ] Engineer 1 (00:00 - 08:00)
- [ ] Engineer 2 (08:00 - 16:00)
- [ ] Engineer 3 (16:00 - 00:00)

---

## 🎯 SUCESSO = 

```
✅ Deploy completed
✅ Zero downtime
✅ Performance good
✅ No errors
✅ Users happy
✅ Team celebrated
```

---

**Tempo estimado:** 1-2 horas (deploy)
**Responsável:** DevOps + Team leads
**Próximo passo:** Monitoring 24/7
