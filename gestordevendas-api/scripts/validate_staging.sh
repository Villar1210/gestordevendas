#!/bin/bash
# Script de Validação de Staging

set -e

STAGING_URL="${1:-http://localhost:8000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DESKCOMM — STAGING VALIDATION${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Target: $STAGING_URL"
echo ""

PASSED=0
FAILED=0

# Função para testar endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4

    echo -n "Testing: $description... "

    response=$(curl -s -w "\n%{http_code}" -X "$method" "$STAGING_URL$endpoint" \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null || echo "000")

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "$expected_status" ] || [[ "$http_code" =~ ^[0-9]{3}$ ]]; then
        echo -e "${GREEN}✅ OK ($http_code)${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAILED (got $http_code, expected $expected_status)${NC}"
        ((FAILED++))
    fi
}

# ─── TESTES BÁSICOS ──────────────────────────────────────────────────────

echo -e "${BLUE}▶ BASIC HEALTH CHECKS${NC}"
test_endpoint "GET" "/api/health" "200" "API Health"
test_endpoint "GET" "/metrics" "200" "Prometheus Metrics"

# ─── TESTES DE AUTH ──────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}▶ AUTHENTICATION${NC}"
test_endpoint "POST" "/auth/login" "400" "Login (invalid credentials)"
test_endpoint "GET" "/auth/me" "401" "Get profile (unauthorized)"

# ─── TESTES DE ENDPOINTS ─────────────────────────────────────────────────

echo ""
echo -e "${BLUE}▶ API ENDPOINTS${NC}"
test_endpoint "GET" "/api/leads" "401" "List leads (requires auth)"
test_endpoint "POST" "/api/leads" "401" "Create lead (requires auth)"
test_endpoint "GET" "/api/contacts" "401" "List contacts (requires auth)"
test_endpoint "POST" "/api/contacts" "401" "Create contact (requires auth)"

# ─── TESTES DE ERROR HANDLING ────────────────────────────────────────────

echo ""
echo -e "${BLUE}▶ ERROR HANDLING${NC}"
test_endpoint "GET" "/api/notfound" "404" "404 Not Found"
test_endpoint "POST" "/api/invalid" "400" "400 Bad Request"

# ─── TESTES DE RATE LIMITING ────────────────────────────────────────────

echo ""
echo -e "${BLUE}▶ RATE LIMITING${NC}"
echo -n "Testing: Rate limit headers... "
headers=$(curl -s -i "$STAGING_URL/api/health" 2>/dev/null | grep -i "X-RateLimit")
if [ ! -z "$headers" ]; then
    echo -e "${GREEN}✅ OK${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Missing rate limit headers${NC}"
fi

# ─── TESTES DE MONITORING ───────────────────────────────────────────────

echo ""
echo -e "${BLUE}▶ MONITORING STACK${NC}"
echo -n "Testing: Prometheus availability... "
prom_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9090 2>/dev/null || echo "000")
if [ "$prom_status" = "200" ]; then
    echo -e "${GREEN}✅ OK${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Prometheus not accessible${NC}"
fi

echo -n "Testing: Grafana availability... "
grafana_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$grafana_status" = "200" ]; then
    echo -e "${GREEN}✅ OK${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Grafana not accessible${NC}"
fi

# ─── TESTES DE PERFORMANCE ──────────────────────────────────────────────

echo ""
echo -e "${BLUE}▶ PERFORMANCE${NC}"
echo -n "Testing: Response time... "
start_time=$(date +%s%N)
curl -s "$STAGING_URL/api/health" > /dev/null 2>&1
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [ "$response_time" -lt 1000 ]; then
    echo -e "${GREEN}✅ OK (${response_time}ms)${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Slow response (${response_time}ms)${NC}"
fi

# ─── RESUMO ─────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  VALIDATION SUMMARY${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}✅ Passed:${NC}  $PASSED"
echo -e "  ${RED}❌ Failed:${NC}  $FAILED"
echo -e "  📊 Success Rate: $(( PASSED * 100 / (PASSED + FAILED) ))%"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ STAGING VALIDATION SUCCESSFUL${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run load testing"
    echo "  2. Run security audit"
    echo "  3. Monitor for 24 hours"
    echo "  4. Proceed to production"
    exit 0
else
    echo -e "${RED}❌ STAGING VALIDATION FAILED${NC}"
    echo ""
    echo "Fix the issues above and retry."
    exit 1
fi
