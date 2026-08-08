#!/bin/bash
# Script de inicialização para desenvolvimento local
# Configura banco de dados e roda seed de Super Usuário

set -e

echo "🚀 Inicializando Deskcomm em modo desenvolvimento..."

# ─── Aguardar PostgreSQL estar pronto ───────────────────────────────────────
echo "⏳ Aguardando PostgreSQL ficar pronto..."
until pg_isready -h localhost -U deskcomm &> /dev/null; do
  echo "  ... PostgreSQL não está pronto, aguardando..."
  sleep 2
done
echo "✅ PostgreSQL está pronto!"

# ─── Aguardar Redis estar pronto ────────────────────────────────────────────
echo "⏳ Aguardando Redis ficar pronto..."
until redis-cli -a "deskcomm_dev_password" ping &> /dev/null; do
  echo "  ... Redis não está pronto, aguardando..."
  sleep 2
done
echo "✅ Redis está pronto!"

# ─── Rodar migrations do Alembic (se tiver) ─────────────────────────────────
echo ""
echo "🔄 Executando migrations do banco..."
# alembic upgrade head  # Descomente se tiver Alembic configurado
echo "   (Migrations não configuradas ainda)"

# ─── Rodar seed de Super Usuário ────────────────────────────────────────────
echo ""
echo "🌱 Criando Super Usuário inicial..."
python -m app.scripts.seed_super_user || echo "⚠️  Erro ao rodar seed (banco pode não estar pronto ainda)"

# ─── Sucesso ────────────────────────────────────────────────────────────────
echo ""
echo "✅ Inicialização concluída!"
echo ""
echo "🎯 Próximas ações:"
echo "   1. Inicie o servidor FastAPI:"
echo "      uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "   2. Acesse a documentação:"
echo "      http://localhost:8000/docs"
echo ""
echo "   3. Endpoints Super Usuário:"
echo "      - GET  http://localhost:8000/api/super/dashboard"
echo "      - GET  http://localhost:8000/api/super/tenants"
echo "      - POST http://localhost:8000/api/super/tenants/{id}/assume-admin"
echo ""
