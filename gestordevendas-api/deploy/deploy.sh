#!/bin/bash
# =============================================================================
# Gestor de Vendas CRM — Script de Deploy (VPS Ubuntu 22.04)
# =============================================================================
# Uso: ./deploy/deploy.sh
# Pré-requisito: docker + docker compose instalados no servidor
# =============================================================================

set -euo pipefail

PROJECT_DIR="/opt/gestordevendas-api"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
ENV_FILE="$PROJECT_DIR/.env"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-ghcr.io/seuusuario/gestordevendas-api}"

echo "🚀 Iniciando deploy do Gestor de Vendas CRM..."

# ── 1. Puxa a imagem mais recente ─────────────────────────────────────────────
echo "📦 Baixando imagem: $REGISTRY:$IMAGE_TAG"
docker pull "$REGISTRY:$IMAGE_TAG"

# ── 2. Atualiza o código ──────────────────────────────────────────────────────
cd "$PROJECT_DIR"
git pull origin main

# ── 3. Aplica migrações (se necessário) ───────────────────────────────────────
# As migrações são SQL puro no Supabase — rodar manualmente no SQL Editor
# ou via supabase CLI:
# supabase db push --db-url $SUPABASE_URL
echo "⚠️  Lembrete: verificar se há migrações pendentes no Supabase"

# ── 4. Reinicia os serviços ───────────────────────────────────────────────────
echo "🔄 Reiniciando serviços..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

# ── 5. Aguarda API ficar saudável ─────────────────────────────────────────────
echo "⏳ Aguardando API..."
timeout 60 bash -c 'until curl -sf http://localhost:8000/health > /dev/null; do sleep 2; done'
echo "✅ API saudável!"

# ── 6. Limpeza de imagens antigas ────────────────────────────────────────────
docker image prune -f

echo "🎉 Deploy concluído!"
docker compose -f "$COMPOSE_FILE" ps
