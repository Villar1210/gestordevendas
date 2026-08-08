#!/bin/bash
# =============================================================================
# Setup inicial do VPS Ubuntu 22.04 para o Gestor de Vendas CRM
# Rodar UMA VEZ no servidor zerado como root.
# =============================================================================

set -euo pipefail

echo "🔧 Configurando VPS para Gestor de Vendas CRM..."

# ── 1. Sistema base ──────────────────────────────────────────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git ufw fail2ban

# ── 2. Docker ────────────────────────────────────────────────────────────────
curl -fsSL https://get.docker.com | sh
usermod -aG docker "$SUDO_USER"

# Docker Compose v2 (plugin)
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p "$DOCKER_CONFIG/cli-plugins"
curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"

# ── 3. Nginx ─────────────────────────────────────────────────────────────────
apt-get install -y nginx
systemctl enable nginx

# ── 4. Certbot (SSL) ─────────────────────────────────────────────────────────
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot

# ── 5. Firewall ──────────────────────────────────────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 6. Fail2ban ──────────────────────────────────────────────────────────────
systemctl enable fail2ban
systemctl start fail2ban

# ── 7. Diretório do projeto ───────────────────────────────────────────────────
mkdir -p /opt/gestordevendas-api
chown "$SUDO_USER:$SUDO_USER" /opt/gestordevendas-api

echo ""
echo "✅ VPS configurado! Próximos passos:"
echo "1. Clone o repositório em /opt/gestordevendas-api"
echo "2. Crie o .env em /opt/gestordevendas-api/.env"
echo "3. Copie deploy/nginx.conf para /etc/nginx/sites-available/gestordevendas"
echo "4. Rode: certbot --nginx -d api.gestordevendas.com.br -d gestordevendas.com.br"
echo "5. Rode: ./deploy/deploy.sh"
