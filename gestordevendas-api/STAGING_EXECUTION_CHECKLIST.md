# ✅ STAGING DEPLOYMENT — EXECUTION CHECKLIST

> **Execute este checklist passo por passo**

---

## 📋 PRÉ-DEPLOYMENT (Fazer agora)

### Comunicação
- [ ] Notificar team que staging deployment vai começar
- [ ] Reservar 2 horas no calendário
- [ ] Ter Slack aberto para comunicação

### Infraestrutura
- [ ] Servidor staging pronto (Ubuntu 20.04+, 4GB RAM, 2 cores)
- [ ] SSH access configurado
- [ ] Firewall: portas 80, 443, 8000, 9090, 3000 abertas
- [ ] Domínio staging-api.ivillar.com.br apontando para IP

### Repositório
- [ ] Código pronto em branch main
- [ ] Todos os testes passando localmente
- [ ] Sem uncommitted changes

---

## 🚀 PASSO 1: SSH para Servidor Staging

```bash
# Execute no seu computador local:
ssh -i ~/.ssh/staging_key deploy@staging-server-ip

# Ou se usar password:
ssh deploy@staging-server-ip
```

**✅ Confirmação:** Você deveria estar no prompt do servidor staging

---

## 🚀 PASSO 2: Preparar Ambiente

```bash
# No servidor staging:

# 1. Criar estrutura de diretórios
sudo mkdir -p /opt/deskcomm
sudo mkdir -p /backups/deskcomm
sudo chown deploy:deploy /opt/deskcomm
sudo chown deploy:deploy /backups/deskcomm

# 2. Verificar Docker
docker --version
docker-compose --version

# Se não tiver Docker, instalar:
# sudo apt-get update
# sudo apt-get install docker.io docker-compose

# 3. Criar diretório de logs
sudo mkdir -p /var/log/deskcomm
sudo chown deploy:deploy /var/log/deskcomm
```

**✅ Confirmação:** Ambos os comandos docker retornam versões

---

## 🚀 PASSO 3: Clone do Repositório

```bash
cd /opt/deskcomm

# Clone o repositório
git clone https://github.com/seu-org/deskcomm.git .

# Verificar
ls -la
# Deve mostrar: app/, server/, docker-compose.yml, etc
```

**✅ Confirmação:** Arquivos principais visíveis com `ls -la`

---

## 🚀 PASSO 4: Configurar Ambiente

```bash
cd /opt/deskcomm

# Copiar arquivo de exemplo
cp .env.example .env.staging

# Editar com seus valores
nano .env.staging
# OU
vim .env.staging

# Valores críticos a configurar:
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
# - NODE_ENV=staging
```

**✅ Confirmação:** `cat .env.staging` mostra valores corretos

---

## 🚀 PASSO 5: Build Docker Images

```bash
cd /opt/deskcomm

# Build das imagens
docker-compose -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  build --no-cache

# Isso vai levar 10-15 minutos...
```

**✅ Confirmação:** Build completa sem erros (status 0)

```
Successfully built...
Successfully tagged...
```

---

## 🚀 PASSO 6: Iniciar PostgreSQL + Redis

```bash
# Iniciar primeiramente os serviços de dados
docker-compose -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  up -d postgres redis

# Aguardar um pouco
sleep 10

# Verificar se estão rodando
docker ps
```

**✅ Confirmação:** `docker ps` mostra postgres e redis com status "healthy" ou "up"

```
postgres     "docker-entrypoint..."   Up (healthy)
redis        "docker-entrypoint..."   Up (healthy)
```

---

## 🚀 PASSO 7: Iniciar API

```bash
# Iniciar o API
docker-compose -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  up -d api

# Aguardar inicializar
sleep 15

# Ver logs
docker-compose logs api | tail -50
```

**✅ Confirmação:** Logs mostram "Uvicorn running on..." ou similar

---

## 🚀 PASSO 8: Iniciar Monitoring

```bash
# Iniciar Prometheus, Grafana, Alertmanager
docker-compose -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  up -d prometheus grafana alertmanager

# Aguardar
sleep 10

# Ver todos os containers
docker-compose ps
```

**✅ Confirmação:** `docker-compose ps` mostra 6+ containers rodando

```
api                    "uvicorn app.main..."   Up
postgres               "docker-entrypoint..."  Up (healthy)
redis                  "docker-entrypoint..."  Up (healthy)
prometheus             "/bin/prometheus..."    Up
grafana                "/run.sh"               Up
alertmanager           "/bin/alertmanager..."  Up
```

---

## 🚀 PASSO 9: Health Checks

```bash
# Verificar API
curl http://localhost:8000/api/health
# Esperado: {"status":"ok",...}

# Verificar Prometheus
curl http://localhost:9090/-/healthy
# Esperado: Prometheus Server is Healthy

# Verificar Grafana
curl http://localhost:3000/api/health
# Esperado: {"status":"ok",...}
```

**✅ Confirmação:** Todos os 3 comandos retornam respostas OK

---

## 🚀 PASSO 10: Smoke Tests

```bash
# Voltar para o seu computador local
exit  # Sair do SSH

# Rodar smoke tests contra staging
pytest tests/smoke/ -v \
  --base-url=http://staging-api.ivillar.com.br:8000

# Ou localmente se está no servidor:
# docker-compose exec api pytest tests/smoke/ -v
```

**✅ Confirmação:** 34/34 smoke tests passam

```
test_api_health PASSED
test_metrics_endpoint PASSED
... (30+ mais)
=== 34 passed in X.XXs ===
```

---

## 🚀 PASSO 11: Seed de Dados

```bash
# SSH de volta para staging
ssh deploy@staging-server-ip

cd /opt/deskcomm

# Criar Super Admin
docker-compose exec api \
  python -m app.scripts.seed_super_user

# Esperado: Mostra credenciais do Super Admin
```

**✅ Confirmação:** Vê output com Super Admin criado

```
✅ Super Admin criado
Email: super-admin@plataforma.local
Password: XXXXX (anotado com segurança)
```

---

## 🚀 PASSO 12: Testar Login

```bash
# Testar login via curl
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "super-admin@plataforma.local",
    "password": "XXXXX"
  }'

# Esperado: Retorna user data + HTTP 200
```

**✅ Confirmação:** Recebe resposta 200 com dados do usuário

---

## 📊 PASSO 13: Verificar Monitoramento

```bash
# No seu computador (browser):

# Prometheus
open http://staging-api.ivillar.com.br:9090

# Grafana
open http://staging-api.ivillar.com.br:3000
# Login: admin / admin

# AlertManager
open http://staging-api.ivillar.com.br:9093
```

**✅ Confirmação:** 
- Prometheus mostra targets scraping
- Grafana mostra dashboards
- AlertManager mostra status

---

## 📊 PASSO 14: Verificar Logs

```bash
# Logs da API
docker-compose logs -f api

# Logs do Prometheus
docker-compose logs prometheus

# Logs do Grafana
docker-compose logs grafana

# Ver tudo
docker-compose logs -f
```

**✅ Confirmação:** Logs estruturados, sem erros críticos

---

## ✅ PASSO 15: Criar Backup Inicial

```bash
# Backup do banco
docker-compose exec postgres \
  pg_dump -U deskcomm ivillar_crm_staging \
  | gzip > /backups/deskcomm/db_initial_$(date +%Y%m%d_%H%M%S).sql.gz

# Verificar
ls -lh /backups/deskcomm/
```

**✅ Confirmação:** Arquivo `.sql.gz` criado > 1MB

---

## 🎊 PASSO 16: Final Validation

```bash
# Rodar todos os testes
docker-compose exec api pytest tests/ -v --tb=short

# Esperado: 100+ testes passando
```

**✅ Confirmação:** 117/117 testes PASSED

---

## 📋 CHECKLIST FINAL

### Serviços OK?
- [ ] API respondendo (HTTP 200 em /api/health)
- [ ] PostgreSQL conectado (banco criado)
- [ ] Redis funcionando (cache OK)
- [ ] Prometheus scraping (targets OK)
- [ ] Grafana live (dashboards carregando)
- [ ] AlertManager OK (status OK)

### Testes OK?
- [ ] 34/34 smoke tests PASSED
- [ ] 117/117 unit tests PASSED
- [ ] Super Admin criado
- [ ] Login funciona

### Backups OK?
- [ ] Backup inicial criado
- [ ] Arquivo > 1MB
- [ ] Localização: /backups/deskcomm/

### Monitoramento OK?
- [ ] Prometheus: targets green
- [ ] Grafana: dashboards visíveis
- [ ] Alertas: 0 alertas críticos

---

## 🎉 STAGING PRONTO!

Se TODOS os checkmarks estão marcados:

```
✅ STAGING DEPLOYMENT SUCESSO!

Próximas etapas:
1. Notificar team que staging está live
2. Coletar feedback
3. Fazer ajustes se necessário
4. Prosseguir para OPÇÃO 2: Load Testing
```

---

## 🆘 TROUBLESHOOTING

### Se API não responde
```bash
docker-compose logs api | tail -100
# Procurar por erros
```

### Se Banco não conecta
```bash
docker-compose logs postgres | tail -50
docker-compose exec postgres psql -U deskcomm -l
```

### Se Prometheus não scrapa
```bash
curl http://localhost:9090/api/v1/targets
# Verificar status dos targets
```

### Se Health check falha
```bash
curl -v http://localhost:8000/api/health
# Ver resposta completa
```

---

**Tempo total esperado:** 1-2 horas
**Status quando completo:** ✅ STAGING LIVE
**Próximo passo:** OPÇÃO 2 - Load Testing

🚀 **BOA SORTE!** 🚀
