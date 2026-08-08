# Deployment Guide — Deskcomm Production

> **Guia completo para deploy em VPS**

## 📋 Pré-Requisitos

- VPS com Ubuntu 20.04+ (4GB RAM mínimo, 2 cores)
- Docker e Docker Compose instalados
- Nginx instalado
- Domínio configurado e apontando para o servidor
- Certificado SSL (Let's Encrypt)

## 🚀 Quick Start

### 1. Conectar via SSH

```bash
ssh root@your-vps-ip

# Ou com chave
ssh -i ~/.ssh/id_rsa root@your-vps-ip
```

### 2. Clonar Repositório

```bash
cd /opt
git clone https://github.com/seu-org/deskcomm.git
cd deskcomm
```

### 3. Configurar Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env.production

# Editar com suas configurações
nano .env.production
```

**Variáveis obrigatórias:**
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@postgres:5432/ivillar_crm
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=your-secret-key-here (gerar com: openssl rand -hex 32)
ADMIN_REGISTRATION_KEY=your-admin-key-here
ALLOWED_ORIGINS=https://ivillar.com.br
```

### 4. Executar Deploy

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

O script irá:
- ✅ Criar backups
- ✅ Build das imagens Docker
- ✅ Iniciar containers
- ✅ Executar migrações
- ✅ Seed de Super Admin
- ✅ Configurar Nginx
- ✅ Configurar SSL

## 📊 Estrutura do Deploy

```
VPS
├── /opt/deskcomm/          ← Aplicação
│   ├── docker-compose.yml
│   ├── .env.production
│   ├── nginx/
│   └── scripts/
├── /backups/deskcomm/      ← Backups automáticos
├── /var/log/deskcomm/      ← Logs
└── /etc/nginx/             ← Configuração Nginx
```

## 🐳 Docker Compose em Produção

### Iniciar

```bash
docker-compose up -d
```

### Ver Logs

```bash
# Todos os serviços
docker-compose logs -f

# Específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Parar

```bash
docker-compose down
```

### Reiniciar

```bash
docker-compose restart
```

## 🔐 SSL com Let's Encrypt

### Gerar Certificado

```bash
sudo certbot certonly --nginx \
  -d ivillar.com.br \
  -d www.ivillar.com.br \
  --non-interactive \
  --agree-tos \
  -m admin@ivillar.com.br
```

### Auto-Renew

Cron job automático instalado em `/etc/cron.d/certbot`

Verificar:
```bash
sudo crontab -l
```

## 📈 Monitoramento

### Health Check

```bash
# API
curl -i https://ivillar.com.br/api/health

# Frontend
curl -i https://ivillar.com.br/
```

### Verificar Containers

```bash
docker ps
docker stats
```

### Logs de Erro

```bash
docker-compose logs backend | grep ERROR
```

## 💾 Backups

### Backup Manual

```bash
# Backup de banco
docker exec deskcomm_postgres pg_dump -U deskcomm ivillar_crm \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup de uploads
tar czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  docker_uploads_data/
```

### Restore

```bash
# Restaurar banco
gunzip < backup_20260808_150000.sql.gz | \
  docker exec -i deskcomm_postgres psql -U deskcomm ivillar_crm
```

## 🔄 Update & Maintenance

### Atualizar Aplicação

```bash
cd /opt/deskcomm

# Fetch das mudanças
git fetch origin

# Pull da nova versão
git pull origin main

# Rebuild e reiniciar
docker-compose up -d --build
```

### Limpar Recursos Docker

```bash
# Remover imagens não usadas
docker image prune -a

# Remover volumes não usados
docker volume prune

# Remover containers parados
docker container prune
```

## 🚨 Troubleshooting

### Backend não inicia

```bash
# Ver logs
docker-compose logs backend

# Verificar banco de dados
docker-compose exec postgres psql -U deskcomm -c "\l"

# Verificar migrações
docker-compose exec backend python -m alembic history
```

### Frontend retorna 404

```bash
# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx

# Ver logs Nginx
sudo tail -f /var/log/nginx/error.log
```

### Banco de dados cheio

```bash
# Ver tamanho
docker exec deskcomm_postgres du -sh /var/lib/postgresql/data

# Limpar logs antigos
docker exec deskcomm_postgres \
  psql -U deskcomm -c "VACUUM ANALYZE;"
```

### Porta já em uso

```bash
# Encontrar processo
lsof -i :3001

# Matar processo
kill -9 <PID>
```

## 📚 Referências

- [Docker Compose](https://docs.docker.com/compose/)
- [Nginx](https://nginx.org/en/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PostgreSQL](https://www.postgresql.org/docs/)

## ✅ Checklist de Deploy

- [ ] VPS configurado (Ubuntu 20.04+)
- [ ] Docker & Docker Compose instalados
- [ ] Domínio apontando para VPS
- [ ] .env.production configurado
- [ ] Certificado SSL gerado
- [ ] Deploy script executado
- [ ] Verificar health checks
- [ ] Criar backup inicial
- [ ] Testar login com Super Admin
- [ ] Verificar logs para erros

---

**Versão:** 1.0.0  
**Última atualização:** 2026-08-08
