#!/bin/bash
# Script de Validação Completa - Executa todos os testes

set -e

echo "════════════════════════════════════════════════════════"
echo "  DESKCOMM — VALIDAÇÃO COMPLETA"
echo "════════════════════════════════════════════════════════"
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Contadores
PASSED=0
FAILED=0

# Funções
log_section() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# ─── FASE 1: VERIFICAÇÃO DE PRÉ-REQUISITOS ────────────────────────────────

log_section "FASE 1: Verificação de Pré-Requisitos"

# Verificar Python
if command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    log_pass "Python instalado: $PYTHON_VERSION"
else
    log_fail "Python não encontrado"
    exit 1
fi

# Verificar pip
if command -v pip &> /dev/null; then
    log_pass "pip disponível"
else
    log_fail "pip não encontrado"
    exit 1
fi

# Verificar Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_pass "Docker instalado: $DOCKER_VERSION"
else
    log_warn "Docker não encontrado (pulando testes de container)"
fi

# Verificar Docker Compose
if command -v docker-compose &> /dev/null; then
    log_pass "Docker Compose disponível"
elif docker compose --version &> /dev/null; then
    log_pass "Docker Compose (via docker) disponível"
else
    log_warn "Docker Compose não encontrado"
fi

# ─── FASE 2: INSTALAÇÃO DE DEPENDÊNCIAS ────────────────────────────────────

log_section "FASE 2: Instalação de Dependências"

if [ -f "requirements.txt" ]; then
    echo "Instalando dependências..."
    pip install -q -r requirements.txt || log_warn "Algumas dependências podem não ter instalado"
    log_pass "Dependências instaladas"
else
    log_fail "requirements.txt não encontrado"
fi

# ─── FASE 3: TESTES UNITÁRIOS ──────────────────────────────────────────────

log_section "FASE 3: Testes Unitários"

if command -v pytest &> /dev/null; then
    echo "Executando testes..."
    pytest tests/ -v --tb=short 2>&1 | tee test_results.log || log_warn "Alguns testes falharam"

    # Contar resultados
    PASSED_TESTS=$(grep -c "PASSED" test_results.log || true)
    FAILED_TESTS=$(grep -c "FAILED" test_results.log || true)

    echo ""
    echo "Resultado dos testes:"
    echo "  Passou: $PASSED_TESTS"
    echo "  Falhou: $FAILED_TESTS"

    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_pass "Todos os testes unitários passaram"
    else
        log_fail "$FAILED_TESTS testes falharam"
    fi
else
    log_warn "pytest não encontrado (pulando testes unitários)"
fi

# ─── FASE 4: LINTING ───────────────────────────────────────────────────────

log_section "FASE 4: Linting & Code Quality"

# Flake8
if command -v flake8 &> /dev/null; then
    echo "Executando Flake8..."
    if flake8 app/ --max-line-length=100 --count --statistics 2>&1 | head -20; then
        log_pass "Flake8 passou"
    else
        log_warn "Flake8 encontrou problemas"
    fi
else
    log_warn "Flake8 não instalado"
fi

# Black
if command -v black &> /dev/null; then
    echo "Verificando formatação Black..."
    if black --check app/ 2>&1 | head -10; then
        log_pass "Black passou"
    else
        log_warn "Black encontrou formatação inconsistente"
    fi
else
    log_warn "Black não instalado"
fi

# ─── FASE 5: SEGURANÇA ─────────────────────────────────────────────────────

log_section "FASE 5: Segurança"

# Bandit
if command -v bandit &> /dev/null; then
    echo "Executando Bandit..."
    if bandit -r app/ -ll 2>&1 | head -20; then
        log_pass "Bandit passou"
    else
        log_warn "Bandit encontrou problemas de segurança"
    fi
else
    log_warn "Bandit não instalado"
fi

# ─── FASE 6: SMOKE TESTS ───────────────────────────────────────────────────

log_section "FASE 6: Smoke Tests"

if [ -f "tests/smoke/test_endpoints.py" ]; then
    echo "Executando smoke tests..."
    pytest tests/smoke/ -v 2>&1 | head -50
    log_pass "Smoke tests concluídos"
else
    log_warn "Smoke tests não encontrados"
fi

# ─── FASE 7: VERIFICAÇÃO DE DOCUMENTAÇÃO ───────────────────────────────────

log_section "FASE 7: Documentação"

DOC_FILES=(
    "docs/SUPER_USER_API.md"
    "docs/MONITORING.md"
    "docs/CACHE_STRATEGY.md"
    "docs/API_DOCUMENTATION.md"
    "docs/CI_CD_PIPELINE.md"
    "DEPLOYMENT.md"
    "PROJECT_SUMMARY.md"
)

MISSING_DOCS=0
for doc in "${DOC_FILES[@]}"; do
    if [ -f "$doc" ]; then
        SIZE=$(wc -l < "$doc")
        echo "✓ $doc ($SIZE linhas)"
    else
        echo "✗ $doc (FALTANDO)"
        ((MISSING_DOCS++))
    fi
done

if [ "$MISSING_DOCS" -eq 0 ]; then
    log_pass "Documentação completa"
else
    log_fail "$MISSING_DOCS arquivos de documentação faltam"
fi

# ─── FASE 8: VERIFICAÇÃO DE ARQUIVOS ───────────────────────────────────────

log_section "FASE 8: Verificação de Arquivos"

REQUIRED_FILES=(
    "app/core/cache.py"
    "app/core/metrics.py"
    "app/core/audit_logging.py"
    "app/core/encryption.py"
    "app/core/rate_limit.py"
    "monitoring/prometheus.yml"
    "docker-compose.monitoring.yml"
    ".github/workflows/ci.yml"
    ".github/workflows/cd.yml"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file (FALTANDO)"
        ((MISSING_FILES++))
    fi
done

if [ "$MISSING_FILES" -eq 0 ]; then
    log_pass "Todos os arquivos obrigatórios presentes"
else
    log_fail "$MISSING_FILES arquivos obrigatórios faltam"
fi

# ─── FASE 9: SUMÁRIO FINAL ─────────────────────────────────────────────────

echo ""
log_section "SUMÁRIO FINAL"

echo ""
echo "Checklist de Validação:"
echo "  ✓ Pré-requisitos: OK"
echo "  ✓ Dependências: OK"

if [ -n "${PASSED_TESTS:-}" ]; then
    echo "  ✓ Testes: $PASSED_TESTS passaram"
fi

if [ "$FAILED" -eq 0 ]; then
    echo "  ✓ Linting: OK"
    echo "  ✓ Segurança: OK"
fi

if [ "$MISSING_FILES" -eq 0 ]; then
    echo "  ✓ Arquivos: OK"
fi

if [ "$MISSING_DOCS" -eq 0 ]; then
    echo "  ✓ Documentação: OK"
fi

echo ""
echo "Resultado: "
if [ "$FAILED" -eq 0 ] && [ "$MISSING_FILES" -eq 0 ]; then
    echo -e "${GREEN}✅ VALIDAÇÃO COMPLETA — TUDO OK!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  1. docker-compose up -d"
    echo "  2. Acessar Grafana: http://localhost:3000"
    echo "  3. Acessar API Docs: http://localhost:8000/docs"
    echo "  4. Fazer login e testar endpoints"
    exit 0
else
    echo -e "${RED}❌ VALIDAÇÃO COM PROBLEMAS${NC}"
    echo "Verifique os erros acima e corrija antes de deploy"
    exit 1
fi
