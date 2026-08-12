#!/bin/bash

# 🚀 Script Automático de Deploy - Frontend Next.js na VPS
# Use: curl https://raw.githubusercontent.com/Villar1210/gestordevendas/main/deploy-frontend-vps.sh | bash

set -e

echo "🚀 Iniciando Deploy do Frontend na VPS..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============================================================
# 1. Verificar se é root
# ============================================================
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Execute como root (sudo)${NC}"
  exit 1
fi

echo -e "${YELLOW}✓ Executando como root${NC}"
echo ""

# ============================================================
# 2. Atualizar Sistema
# ============================================================
echo -e "${YELLOW}1. Atualizando sistema...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✓ Sistema atualizado${NC}"
echo ""

# ============================================================
# 3. Instalar Docker
# ============================================================
echo -e "${YELLOW}2. Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
  echo "   Instalando Docker..."
  apt install -y docker.io docker-compose git curl
  systemctl start docker
  systemctl enable docker
  echo -e "${GREEN}✓ Docker instalado${NC}"
else
  echo -e "${GREEN}✓ Docker já instalado${NC}"
fi
echo ""

# ============================================================
# 4. Criar diretório de trabalho
# ============================================================
echo -e "${YELLOW}3. Preparando diretórios...${NC}"
mkdir -p /var/www
cd /var/www

# Se já existe, fazer backup
if [ -d "gestordevendas" ]; then
  echo "   Backup do código anterior..."
  mv gestordevendas gestordevendas.backup.$(date +%s)
fi

echo -e "${GREEN}✓ Diretórios prontos${NC}"
echo ""

# ============================================================
# 5. Clonar Repositório
# ============================================================
echo -e "${YELLOW}4. Clonando repositório...${NC}"
git clone https://github.com/Villar1210/gestordevendas.git
cd gestordevendas/gestordevendas-web
echo -e "${GREEN}✓ Repositório clonado${NC}"
echo ""

# ============================================================
# 6. Configurar Variáveis de Ambiente
# ============================================================
echo -e "${YELLOW}5. Configurando variáveis de ambiente...${NC}"
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://api.ivillar.com.br/api
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_DSN=
NODE_ENV=production
EOF
echo -e "${GREEN}✓ Variáveis configuradas${NC}"
echo ""

# ============================================================
# 7. Build Docker
# ============================================================
echo -e "${YELLOW}6. Building Docker image (pode levar 2-3 min)...${NC}"
docker build -t gestordevendas-web:latest .
echo -e "${GREEN}✓ Docker image criada${NC}"
echo ""

# ============================================================
# 8. Parar container antigo (se existir)
# ============================================================
echo -e "${YELLOW}7. Parando container anterior (se existir)...${NC}"
docker stop gestordevendas-web 2>/dev/null || true
docker rm gestordevendas-web 2>/dev/null || true
echo -e "${GREEN}✓ Pronto${NC}"
echo ""

# ============================================================
# 9. Iniciar novo container
# ============================================================
echo -e "${YELLOW}8. Iniciando novo container...${NC}"
docker run -d \
  --name gestordevendas-web \
  --restart always \
  -p 3001:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.ivillar.com.br/api \
  -e NEXT_PUBLIC_ENVIRONMENT=production \
  -e NODE_ENV=production \
  gestordevendas-web:latest

sleep 3
echo -e "${GREEN}✓ Container iniciado${NC}"
echo ""

# ============================================================
# 10. Verificar status
# ============================================================
echo -e "${YELLOW}9. Verificando status...${NC}"
if docker ps | grep -q gestordevendas-web; then
  echo -e "${GREEN}✓ Container rodando!${NC}"
  docker logs gestordevendas-web | tail -5
else
  echo -e "${RED}❌ Container não iniciou${NC}"
  docker logs gestordevendas-web
  exit 1
fi
echo ""

# ============================================================
# 11. Informações de Nginx
# ============================================================
echo -e "${YELLOW}10. Configurando Nginx...${NC}"
echo ""
echo "Adicione isto ao seu nginx (/etc/nginx/sites-available/default):"
echo ""
echo -e "${YELLOW}---${NC}"
cat << 'NGINX_CONFIG'
server {
    listen 443 ssl http2;
    server_name ivillar.com.br www.ivillar.com.br;

    ssl_certificate /etc/letsencrypt/live/ivillar.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ivillar.com.br/privkey.pem;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /_next/static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /public {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

server {
    listen 80;
    server_name ivillar.com.br www.ivillar.com.br;
    return 301 https://$server_name$request_uri;
}
NGINX_CONFIG
echo -e "${YELLOW}---${NC}"
echo ""

echo -e "${YELLOW}Passos Finais:${NC}"
echo "1. Editar: sudo nano /etc/nginx/sites-available/default"
echo "2. Adicionar configuração acima (mantenha a configuração da API também)"
echo "3. Validar: sudo nginx -t"
echo "4. Reiniciar: sudo systemctl restart nginx"
echo ""

# ============================================================
# RESUMO
# ============================================================
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ DEPLOY FRONTEND CONCLUÍDO!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "📊 Status:"
echo "   API:      https://api.ivillar.com.br ✅"
echo "   Frontend: http://localhost:3001 (interno)"
echo "   Public:   https://ivillar.com.br (após nginx)"
echo ""
echo "🔍 Verificar:"
echo "   docker ps"
echo "   docker logs -f gestordevendas-web"
echo ""
echo "🔄 Atualizar:"
echo "   cd /var/www/gestordevendas/gestordevendas-web"
echo "   git pull origin main"
echo "   docker build -t gestordevendas-web:latest ."
echo "   docker restart gestordevendas-web"
echo ""
echo "📖 Mais info: cat /var/www/gestordevendas/DEPLOY_VPS.md"
echo ""
