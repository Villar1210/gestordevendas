# Deploy — Gestor de Vendas CRM

Instruções para deploy em produção.

---

## 🚀 Pré-requisitos

- **Python 3.13+**
- **Supabase** (PostgreSQL + Auth)
- **Redis** (cache/tasks)
- **VPS ou Servidor** com SSH acesso
- **Domain + SSL** (Let's Encrypt)

---

## 📋 1. Setup Local (Desenvolvimento)

### Clone o repositório
```bash
git clone https://github.com/Villar1210/gestordevendas.git
cd gestordevendas-api
```

### Crie um ambiente virtual
```bash
python3.13 -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows
```

### Instale dependências
```bash
pip install -r requirements.txt
```

### Configure variáveis de ambiente
```bash
cp .env.dev .env
# Edite .env com suas credenciais do Supabase
```

### Execute migrações (desenvolvimento)
```bash
# Nota: Em dev, as migrações são aplicadas manualmente ao Supabase Dashboard
# Para aplicar via script:
python scripts/run_migrations.py
```

### Rode o servidor
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Acesse: http://localhost:8000/api/docs

---

## 🌐 2. Deploy em Produção (VPS)

### 2.1 Preparar o VPS

```bash
# SSH no servidor
ssh -i ~/.ssh/deploy_key root@187.77.225.184

# Atualizar sistema
apt update && apt upgrade -y

# Instalar dependências
apt install -y python3.13 python3.13-venv postgresql-client redis-server nginx git

# Criar usuário de deploy
useradd -m -s /bin/bash deploy
```

### 2.2 Clonar repositório no VPS

```bash
sudo -u deploy git clone https://github.com/Villar1210/gestordevendas.git /app/gestordevendas-api
cd /app/gestordevendas-api
```

### 2.3 Setup Python

```bash
sudo -u deploy python3.13 -m venv venv
sudo -u deploy venv/bin/pip install --upgrade pip
sudo -u deploy venv/bin/pip install -r requirements.txt
```

### 2.4 Configurar variáveis de ambiente

```bash
sudo -u deploy cp .env.production .env
# Editar com credenciais reais
sudo nano /app/gestordevendas-api/.env
```

### 2.5 Aplicar migrações

```bash
cd /app/gestordevendas-api
sudo -u deploy venv/bin/python scripts/run_migrations.py
```

### 2.6 Testar servidor

```bash
cd /app/gestordevendas-api
sudo -u deploy venv/bin/python main.py
# Ctrl+C para parar
```

---

## 🔧 3. Configurar Systemd Service

Criar arquivo `/etc/systemd/system/gestordevendas-api.service`:

```ini
[Unit]
Description=Gestor de Vendas API
After=network.target redis-server.service

[Service]
Type=notify
User=deploy
WorkingDirectory=/app/gestordevendas-api
Environment="PATH=/app/gestordevendas-api/venv/bin"
ExecStart=/app/gestordevendas-api/venv/bin/uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --loop uvloop

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ativar serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable gestordevendas-api
sudo systemctl start gestordevendas-api
sudo systemctl status gestordevendas-api
```

---

## 🌐 4. Configurar Nginx (Reverse Proxy)

Criar arquivo `/etc/nginx/sites-available/gestordevendas`:

```nginx
upstream gestordevendas_api {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name api-gestordevendas.com.br;

    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api-gestordevendas.com.br;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api-gestordevendas.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-gestordevendas.com.br/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;

    location / {
        proxy_pass http://gestordevendas_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files (se houver)
    location /static/ {
        alias /app/gestordevendas-api/static/;
        expires 30d;
    }
}
```

Ativar:

```bash
sudo ln -s /etc/nginx/sites-available/gestordevendas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 5. SSL com Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado
sudo certbot certonly --nginx -d api-gestordevendas.com.br

# Auto-renew
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## 📊 6. Monitoramento & Logs

### Ver logs da API

```bash
journalctl -u gestordevendas-api -f
```

### Health check

```bash
curl https://api-gestordevendas.com.br/health
# Resposta esperada:
# {"status":"ok","environment":"production","debug":false}
```

### Monitorar CPU/Memória

```bash
# Instalar
sudo apt install -y htop

# Usar
htop
```

---

## 💾 7. Backup & Restore

### Fazer backup automático

```bash
# Adicionar ao crontab (todo dia às 2 AM)
sudo -u deploy crontab -e

# Adicionar linha:
0 2 * * * cd /app/gestordevendas-api && venv/bin/python scripts/backup_restore.py backup
```

### Listar backups

```bash
cd /app/gestordevendas-api
venv/bin/python scripts/backup_restore.py list
```

### Restaurar backup

```bash
cd /app/gestordevendas-api
venv/bin/python scripts/backup_restore.py restore backups/backup_20260811_021530.json.gz
```

---

## 🚨 8. Troubleshooting

### API não inicia
```bash
# Checar logs
journalctl -u gestordevendas-api -e

# Testar conexão Supabase
python -c "from app.infra.supabase.client import get_supabase_client; get_supabase_client()"
```

### Conexão Supabase falha
```bash
# Verificar .env
cat /app/gestordevendas-api/.env | grep SUPABASE

# Testar credenciais
curl https://xxxxx.supabase.co/rest/v1/ \
  -H "apikey: xxxxx"
```

### Rate limit muito baixo
```bash
# Editar nginx.conf
sudo nano /etc/nginx/sites-available/gestordevendas

# Aumentar:
# rate=100r/s  (requisições por segundo)
# burst=200    (rajadas permitidas)
```

---

## 📈 9. Próximos Passos

- [ ] Configurar DataDog/Sentry para monitoring
- [ ] Implementar alertas (Email/Slack)
- [ ] Configurar CDN para assets estáticos
- [ ] Implementar scaling horizontal (Kubernetes)
- [ ] Configurar failover/high availability

---

## 📞 Suporte

Para problemas no deploy:
1. Checar os logs: `journalctl -u gestordevendas-api -f`
2. Testar health: `curl https://api-gestordevendas.com.br/health`
3. Abrir issue no GitHub

---

**Versão:** 1.0.0  
**Última atualização:** 2026-08-11
