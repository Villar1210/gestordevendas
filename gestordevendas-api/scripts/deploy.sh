#!/bin/bash
# Script de Deploy para VPS — Deskcomm Production

set -e

# ─── Configuração ──────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/seu-org/deskcomm.git}"
DEPLOY_DIR="/opt/deskcomm"
BACKUP_DIR="/backups/deskcomm"
SERVICE_NAME="deskcomm"
DOMAIN="ivillar.com.br"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ─── Funções ──────────────────────────────────────────────────────────────

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ─── Verificações Pré-Deploy ──────────────────────────────────────────────

log_info "Verificando pré-requisitos..."

# Verificar Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker não está instalado"
    exit 1
fi

# Verificar Docker Compose
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose não está instalado"
    exit 1
fi

log_success "Docker e Docker Compose instalados"

# ─── Criar Backup ─────────────────────────────────────────────────────────

if [ -d "$DEPLOY_DIR" ]; then
    log_info "Criando backup do deploy anterior..."

    mkdir -p "$BACKUP_DIR"
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/deskcomm_$BACKUP_DATE"

    # Backup do banco de dados
    if [ -f "$DEPLOY_DIR/docker-compose.yml" ]; then
        mkdir -p "$BACKUP_PATH"

        # Dump do PostgreSQL
        docker exec deskcomm_postgres_dev pg_dump -U deskcomm ivillar_crm \
            | gzip > "$BACKUP_PATH/database_$BACKUP_DATE.sql.gz"

        log_success "Backup criado em $BACKUP_PATH"
    fi
fi

# ─── Clonar/Atualizar Repositório ──────────────────────────────────────────

log_info "Clonando/atualizando repositório..."

if [ ! -d "$DEPLOY_DIR" ]; then
    mkdir -p "$DEPLOY_DIR"
    git clone "$REPO_URL" "$DEPLOY_DIR"
else
    cd "$DEPLOY_DIR"
    git fetch origin
    git pull origin main
fi

cd "$DEPLOY_DIR"

log_success "Repositório atualizado"

# ─── Preparar Ambiente ────────────────────────────────────────────────────

log_info "Preparando ambiente de produção..."

# Copiar .env de exemplo se não existir
if [ ! -f "$DEPLOY_DIR/.env.production" ]; then
    cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env.production"
    log_info "⚠️  .env.production criado. Configure as variáveis de ambiente!"
    log_info "Atualize: DATABASE_URL, REDIS_URL, JWT_SECRET, etc."
    exit 1
fi

# ─── Build das Imagens Docker ─────────────────────────────────────────────

log_info "Building imagens Docker..."

docker-compose -f "$DEPLOY_DIR/docker-compose.yml" build --no-cache

log_success "Build concluído"

# ─── Iniciar Serviços ─────────────────────────────────────────────────────

log_info "Iniciando serviços..."

docker-compose -f "$DEPLOY_DIR/docker-compose.yml" up -d

log_success "Serviços iniciados"

# ─── Verificar Saúde dos Serviços ──────────────────────────────────────────

log_info "Verificando saúde dos serviços..."

# Aguardar PostgreSQL
for i in {1..30}; do
    if docker exec deskcomm_postgres_dev pg_isready -U deskcomm &> /dev/null; then
        log_success "PostgreSQL pronto"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "PostgreSQL não ficou pronto"
        exit 1
    fi
    sleep 2
done

# Aguardar Redis
for i in {1..30}; do
    if docker exec deskcomm_redis_dev redis-cli ping &> /dev/null; then
        log_success "Redis pronto"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Redis não ficou pronto"
        exit 1
    fi
    sleep 2
done

# ─── Executar Migrações ───────────────────────────────────────────────────

log_info "Executando migrações de banco..."

# Se usar Alembic:
# docker-compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T backend alembic upgrade head

log_success "Migrações concluídas"

# ─── Seed de Dados ────────────────────────────────────────────────────────

log_info "Executando seed de Super Admin..."

docker-compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T backend \
    python -m app.scripts.seed_super_user

log_success "Seed concluído"

# ─── Configurar Nginx (Proxy Reverso) ──────────────────────────────────────

log_info "Configurando Nginx..."

if [ ! -d "/etc/nginx/sites-available" ]; then
    log_error "Nginx não está instalado"
    exit 1
fi

# Copiar configuração do Nginx
sudo cp "$DEPLOY_DIR/nginx/conf.d/ivillar.conf" \
    /etc/nginx/sites-available/ivillar.conf

# Ativar site
sudo ln -sf /etc/nginx/sites-available/ivillar.conf \
    /etc/nginx/sites-enabled/ivillar.conf

# Remover default
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração
if sudo nginx -t; then
    sudo systemctl reload nginx
    log_success "Nginx configurado e recarregado"
else
    log_error "Erro na configuração do Nginx"
    exit 1
fi

# ─── Configurar SSL com Certbot ───────────────────────────────────────────

log_info "Configurando SSL com Let's Encrypt..."

if command -v certbot &> /dev/null; then
    sudo certbot certonly --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
        --non-interactive --agree-tos -m "admin@$DOMAIN"

    log_success "Certificado SSL gerado"
else
    log_info "⚠️  Certbot não está instalado. Instale com: sudo apt-get install certbot python3-certbot-nginx"
fi

# ─── Configurar Auto-Renew SSL ───────────────────────────────────────────

log_info "Configurando renovação automática de SSL..."

# Adicionar cron job para renovação
CRON_CMD="0 3 * * * /usr/bin/certbot renew --quiet && /bin/systemctl reload nginx"

if ! (sudo crontab -l 2>/dev/null | grep -q "certbot renew"); then
    echo "$CRON_CMD" | sudo crontab -
    log_success "Auto-renew configurado (3:00 AM diariamente)"
fi

# ─── Configurar Monitoramento ─────────────────────────────────────────────

log_info "Configurando monitoramento..."

# Criar diretório para logs
mkdir -p /var/log/deskcomm

# Configurar rotação de logs
sudo tee /etc/logrotate.d/deskcomm > /dev/null <<EOF
/var/log/deskcomm/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
EOF

log_success "Monitoramento configurado"

# ─── Status Final ──────────────────────────────────────────────────────────

log_info "Verificando status dos containers..."

docker-compose -f "$DEPLOY_DIR/docker-compose.yml" ps

log_success "Deploy concluído!"

# ─── Informações Importantes ──────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ DESKCOMM DEPLOY CONCLUÍDO"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📍 URL da Aplicação:"
echo "   https://$DOMAIN"
echo ""
echo "🔑 Super Admin:"
echo "   Email: super-admin@plataforma.local"
echo "   (Verifique o log do seed acima)"
echo ""
echo "📊 Endpoints Importantes:"
echo "   API:       https://$DOMAIN/api"
echo "   Docs:      https://$DOMAIN/docs"
echo "   Dashboard: https://$DOMAIN"
echo ""
echo "💾 Backup:"
echo "   Localização: $BACKUP_PATH"
echo ""
echo "📝 Logs:"
echo "   docker-compose logs -f"
echo "   docker-compose logs backend"
echo "   docker-compose logs frontend"
echo ""
echo "🔄 Reiniciar Serviços:"
echo "   docker-compose restart"
echo ""
echo "🛑 Parar Serviços:"
echo "   docker-compose down"
echo ""
echo "═══════════════════════════════════════════════════════════════"
