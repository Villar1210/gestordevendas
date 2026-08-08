#!/bin/bash
# Script de backup automático para DeskComm

BACKUP_DIR="/opt/backups/deskcomm"
DATE=$(date '+%Y%m%d_%H%M%S')
DB_USER="deskcomm"
DB_NAME="deskcomm_db"
RETENTION_DAYS=7

echo "[$(date)] Iniciando backup..."

# Backup do PostgreSQL
echo "[$(date)] Fazendo backup do PostgreSQL..."
docker-compose exec -T postgres pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"

# Backup do Redis
echo "[$(date)] Fazendo backup do Redis..."
docker-compose exec -T redis redis-cli BGSAVE > /dev/null 2>&1
sleep 2
docker-compose exec redis ls -la /data/ > "$BACKUP_DIR/redis_$DATE.txt"

# Tamanho dos backups
echo "[$(date)] Status dos backups:"
du -sh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5

# Limpeza de backups antigos (> 7 dias)
echo "[$(date)] Limpando backups com mais de $RETENTION_DAYS dias..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.txt" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup concluído!"
echo ""
