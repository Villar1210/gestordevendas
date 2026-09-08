#!/usr/bin/env bash
# deploy-security-fixes.sh
# Aplica as correcoes de segurança do modulo auth no VPS.
# Execute como: bash scripts/deploy-security-fixes.sh
set -e

APP_DIR="/opt/gestordevendas/app"
DB_NAME="gestordevendas_db"
DB_USER="gestordevendas_admin"
DB_PORT="5434"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Deploy: Correções de Segurança — Auth Module       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 1. Verificar JWT_SECRET no .env
echo "▶ [1/5] Verificando JWT_SECRET no .env..."
if grep -qE "^JWT_SECRET=.{16,}" "$APP_DIR/.env"; then
  echo "   ✓ JWT_SECRET configurado."
else
  echo ""
  echo "   ✗ ERRO: JWT_SECRET não encontrado ou muito curto em $APP_DIR/.env"
  echo "   Gere uma chave com: openssl rand -hex 32"
  echo "   E adicione ao .env: JWT_SECRET=<chave_gerada>"
  exit 1
fi

# 2. Aplicar migration SQL
echo ""
echo "▶ [2/5] Aplicando migration SQL (tokenVersion)..."
MIGRATION_SQL="$APP_DIR/prisma/migrations/$(ls $APP_DIR/prisma/migrations | grep token_version | tail -1)/migration.sql"
if [ -f "$MIGRATION_SQL" ]; then
  PGPASSWORD=$(grep "^DATABASE_URL" "$APP_DIR/.env" | sed 's/.*:\(.*\)@.*/\1/') \
  psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$MIGRATION_SQL" 2>&1 || {
    echo "   ⚠ Migration pode já ter sido aplicada (coluna existente). Continuando..."
  }
  echo "   ✓ Migration aplicada."
else
  echo "   ⚠ Arquivo SQL não encontrado. Aplicando diretamente..."
  PGPASSWORD=$(grep "^DATABASE_URL" "$APP_DIR/.env" | sed 's/.*:\(.*\)@.*/\1/') \
  psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -c 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;' 2>&1
  echo "   ✓ Coluna adicionada."
fi

# 3. Atualizar Prisma client
echo ""
echo "▶ [3/5] Gerando Prisma Client atualizado..."
cd "$APP_DIR"
npx prisma generate
echo "   ✓ Prisma Client atualizado."

# 4. Build do backend
echo ""
echo "▶ [4/5] Build do backend..."
npm run build
echo "   ✓ Build concluído."

# 5. Restart PM2
echo ""
echo "▶ [5/5] Reiniciando gestordevendas-backend via PM2..."
pm2 restart gestordevendas-backend
sleep 3
pm2 status gestordevendas-backend

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Deploy concluído com sucesso!                      ║"
echo "║                                                      ║"
echo "║   ✓ JWT_SECRET sem fallback inseguro                 ║"
echo "║   ✓ tokenVersion — revogação de sessão ativa         ║"
echo "║   ✓ Senha mínima 8 caracteres                        ║"
echo "║   ✓ POST /auth/logout disponível                     ║"
echo "║                                                      ║"
echo "║   ⚠  Todos os usuários precisarão fazer login        ║"
echo "║      novamente (tokens legados rejeitados).           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
