#!/bin/bash
# Monitor de saúde da API

API_URL="http://localhost:8000/health"
LOG_FILE="/opt/deskcomm/gestordevendas-api/logs/monitor.log"

check_health() {
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "[$TIMESTAMP] ✅ API Healthy - HTTP $HTTP_CODE" >> "$LOG_FILE"
        return 0
    else
        echo "[$TIMESTAMP] ❌ API Down - HTTP $HTTP_CODE" >> "$LOG_FILE"
        # TODO: Enviar alerta (email, Slack, etc)
        return 1
    fi
}

check_health
