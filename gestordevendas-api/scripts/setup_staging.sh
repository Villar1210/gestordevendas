#!/bin/bash
# Setup Staging Environment - Deskcomm
# Execute este script em um servidor Ubuntu 20.04+

set -e

# ─── CORES ────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────

STAGING_URL="${1:-staging-api.ivillar.com.br}"
STAGING_IP="${2:-your-staging-ip}"
DEPLOY_DIR="/opt/deskcomm"
BACKUP_DIR="/backups/deskcomm"

# ─── FUNÇÕES ──────────────────────────────────────────────────────────────

log_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

log_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ─── INÍCIO DO SETUP ──────────────────────────────────────────────────────

log_header "DESKCOMM STAGING DEPLOYMENT"

echo "Target: $STAGING_URL"
echo "IP: $STAGING_IP"
echo "Deploy Dir: $DEPLOY_DIR"
echo ""

# ─── PASSO 1: PRÉ-REQUISITOS ──────────────────────────────────────────────

log_header "PASSO 1: Verificar Pré-requisitos"

log_step "Verificando Ubuntu version..."
if grep -q "20.04\|22.04" /etc/os-release; then
    log_success "Ubuntu OK"
else
    log_error "Ubuntu 20.04+ requerido"
    exit 1
fi

log_step "Verificando Docker..."
if ! command -v docker &> /dev/null; then
    log_error "Docker não instalado. Instale com: sudo apt-get install docker.io"
    exit 1
fi
log_success "Docker instalado"

log_step "Verificando Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose não instalado"
    exit 1
fi
log_success "Docker Compose instalado"

log_step "Verificando Git..."
if ! command -v git &> /dev/null; then
    log_error "Git não instalado"
    exit 1
fi
log_success "Git instalado"

log_step "Verificando espaço em disco..."
DISK_FREE=$(df /opt | awk 'NR==2 {print $4}')
if [ "$DISK_FREE" -lt 20000000 ]; then
    log_error "Espaço em disco insuficiente (< 20GB)"
    exit 1
fi
log_success "Espaço em disco OK ($(( DISK_FREE / 1000000 ))GB disponível)"

# ─── PASSO 2: CLONE DO REPOSITÓRIO ────────────────────────────────────────

log_header "PASSO 2: Clone do Repositório"

if [ ! -d "$DEPLOY_DIR" ]; then
    log_step "Clonando repositório..."
    mkdir -p $(dirname "$DEPLOY_DIR")
    git clone https://github.com/seu-org/deskcomm.git "$DEPLOY_DIR"
    log_success "Repositório clonado"
else
    log_step "Diretório já existe, atualizando..."
    cd "$DEPLOY_DIR"
    git fetch origin
    git pull origin main
    log_success "Repositório atualizado"
fi

cd "$DEPLOY_DIR"

# ─── PASSO 3: CONFIGURAR VARIÁVEIS DE AMBIENTE ────────────────────────────

log_header "PASSO 3: Configurar Ambiente"

if [ ! -f ".env.staging" ]; then
    log_step "Criando .env.staging..."
    cp .env.example .env.staging

    # Atualizar valores para staging
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://deskcomm:staging_password@postgres:5432/ivillar_crm_staging|g" .env.staging
    sed -i "s|REDIS_URL=.*|REDIS_URL=redis://redis:6379|g" .env.staging
    sed -i "s|NODE_ENV=.*|NODE_ENV=staging|g" .env.staging

    log_success ".env.staging criado"
    log_error "⚠️  EDITE .env.staging com valores reais antes de continuar!"
    echo ""
    echo "Valores críticos a configurar:"
    echo "  - JWT_SECRET"
    echo "  - DATABASE_URL (username/password)"
    echo "  - API_KEY_*"
    echo "  - SMTP_* (para emails)"
    echo ""
    read -p "Pressione ENTER quando .env.staging estiver configurado..."
else
    log_success ".env.staging já configurado"
fi

# ─── PASSO 4: BUILD DOCKER IMAGES ────────────────────────────────────────

log_header "PASSO 4: Build Docker Images"

log_step "Building API image..."
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml build api

log_step "Building monitoring stack..."
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml build

log_success "Build completo"

# ─── PASSO 5: CRIAR BACKUP DIR ────────────────────────────────────────────

log_header "PASSO 5: Setup de Backups"

log_step "Criando diretório de backups..."
mkdir -p "$BACKUP_DIR"
chmod 755 "$BACKUP_DIR"
log_success "Backup directory ready: $BACKUP_DIR"

# ─── PASSO 6: INICIAR SERVIÇOS ────────────────────────────────────────────

log_header "PASSO 6: Iniciar Serviços"

log_step "Iniciando PostgreSQL + Redis..."
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d postgres redis

log_step "Aguardando banco estar pronto..."
sleep 10

log_step "Iniciando API..."
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d api

log_step "Iniciando Monitoring..."
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d prometheus grafana alertmanager

sleep 5

log_success "Serviços iniciados"

# ─── PASSO 7: VERIFICAR SAÚDE ────────────────────────────────────────────

log_header "PASSO 7: Health Check"

log_step "Verificando containers..."
docker-compose ps

log_step "Aguardando API estar pronta..."
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        log_success "API está respondendo"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "API não respondeu após 60s"
        exit 1
    fi
    sleep 2
done

log_step "Testando endpoints..."
HEALTH_RESPONSE=$(curl -s http://localhost:8000/api/health)
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    log_success "Health check OK: $HEALTH_RESPONSE"
else
    log_error "Health check falhou"
    exit 1
fi

log_step "Verificando Prometheus..."
PROM_STATUS=$(curl -s http://localhost:9090/-/healthy)
if [ ! -z "$PROM_STATUS" ]; then
    log_success "Prometheus OK"
fi

log_step "Verificando Grafana..."
GRAFANA_STATUS=$(curl -s http://localhost:3000/api/health)
if echo "$GRAFANA_STATUS" | grep -q "ok"; then
    log_success "Grafana OK"
fi

# ─── PASSO 8: SMOKE TESTS ────────────────────────────────────────────────

log_header "PASSO 8: Smoke Tests"

log_step "Rodando smoke tests..."
if command -v pytest &> /dev/null; then
    pytest tests/smoke/ -v --base-url=http://localhost:8000 || log_error "Alguns testes falharam"
else
    log_error "pytest não instalado, pulando smoke tests"
fi

# ─── PASSO 9: CRIAR USUÁRIO DE TESTE ───────────────────────────────────────

log_header "PASSO 9: Seed de Dados"

log_step "Criando Super Admin..."
docker-compose exec -T api python -m app.scripts.seed_super_user

log_success "Super Admin criado"

# ─── RESUMO FINAL ─────────────────────────────────────────────────────────

log_header "STAGING DEPLOYMENT COMPLETO ✅"

echo ""
echo "🎉 DESKCOMM STAGING ESTÁ PRONTO!"
echo ""
echo "📍 URLs de Acesso:"
echo "   API:         http://localhost:8000"
echo "   Docs:        http://localhost:8000/docs"
echo "   Prometheus: http://localhost:9090"
echo "   Grafana:     http://localhost:3000 (admin/admin)"
echo "   AlertMgr:    http://localhost:9093"
echo ""
echo "🔐 Credenciais de Teste:"
echo "   Email: super-admin@plataforma.local"
echo "   (Verifique os logs acima para a senha)"
echo ""
echo "📊 Monitoramento:"
echo "   docker-compose logs -f api"
echo "   docker-compose logs -f prometheus"
echo ""
echo "🛑 Parar Serviços:"
echo "   docker-compose down"
echo ""
echo "✅ Próximo passo: Rodar testes completos"
echo ""
