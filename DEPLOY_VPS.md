# 🚀 Deploy Frontend na VPS (187.77.225.184)

## 1️⃣ Conectar ao VPS via SSH

```bash
ssh root@187.77.225.184
# ou
ssh -i sua-chave.pem root@187.77.225.184
```

## 2️⃣ Preparar o Servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker (se ainda não tiver)
sudo apt install -y docker.io docker-compose git

# Adicionar ao grupo docker
sudo usermod -aG docker root

# Verificar instalação
docker --version
docker-compose --version
```

## 3️⃣ Clonar Repositório

```bash
cd /var/www
git clone https://github.com/Villar1210/gestordevendas.git
cd gestordevendas/gestordevendas-web
```

## 4️⃣ Configurar Variáveis de Ambiente

```bash
cat > .env.production << 'ENDOFFILE'
NEXT_PUBLIC_API_URL=https://api.ivillar.com.br/api
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_DSN=
NODE_ENV=production
ENDOFFILE
```

## 5️⃣ Build Docker

```bash
# Build da imagem
docker build -t gestordevendas-web:latest .

# Verificar
docker images | grep gestordevendas
```

## 6️⃣ Iniciar Container

```bash
# Iniciar frontend
docker run -d \
  --name gestordevendas-web \
  --restart always \
  -p 3001:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.ivillar.com.br/api \
  -e NEXT_PUBLIC_ENVIRONMENT=production \
  -e NODE_ENV=production \
  gestordevendas-web:latest

# Verificar status
docker ps | grep gestordevendas
docker logs gestordevendas-web
```

## 7️⃣ Configurar Nginx (Reverse Proxy)

```bash
# Acessar nginx
sudo nano /etc/nginx/sites-available/default
```

**Adicionar esta configuração (abaixo do bloco da API):**

```nginx
# Frontend - Next.js
server {
    listen 443 ssl http2;
    server_name ivillar.com.br www.ivillar.com.br;

    ssl_certificate /etc/letsencrypt/live/ivillar.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ivillar.com.br/privkey.pem;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
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

    # Cache estático
    location /_next/static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /public {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name ivillar.com.br www.ivillar.com.br;
    return 301 https://$server_name$request_uri;
}
```

**Salvar com:** Ctrl+X → Y → Enter

## 8️⃣ Verificar Nginx

```bash
# Verificar sintaxe
sudo nginx -t

# Reiniciar nginx
sudo systemctl restart nginx

# Status
sudo systemctl status nginx
```

## 9️⃣ Atualizar DNS (se necessário)

Se estiver usando novo domínio, apontar para o VPS:

```
ivillar.com.br    A    187.77.225.184
www.ivillar.com.br CNAME ivillar.com.br
```

## 🔟 Testar

```bash
# Testar conectividade
curl -s https://api.ivillar.com.br/health
curl -s https://ivillar.com.br/ | head -20

# Ver logs
docker logs -f gestordevendas-web
```

## 🔄 Atualizar Frontend

Quando tiver novas mudanças:

```bash
cd /var/www/gestordevendas/gestordevendas-web

# Pull novo código
git pull origin main

# Rebuild
docker build -t gestordevendas-web:latest .

# Stop container antigo
docker stop gestordevendas-web
docker rm gestordevendas-web

# Iniciar novo
docker run -d \
  --name gestordevendas-web \
  --restart always \
  -p 3001:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.ivillar.com.br/api \
  -e NEXT_PUBLIC_ENVIRONMENT=production \
  -e NODE_ENV=production \
  gestordevendas-web:latest
```

## 📊 Monitoramento

```bash
# Ver containers rodando
docker ps

# Ver logs
docker logs gestordevendas-web

# Uso de recursos
docker stats gestordevendas-web

# Reiniciar se cair
docker restart gestordevendas-web
```

## 🆘 Troubleshooting

**Porta 3001 já em uso:**
```bash
sudo lsof -i :3001
sudo kill -9 PID
```

**Nginx erro:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

**Container não inicia:**
```bash
docker logs gestordevendas-web
docker inspect gestordevendas-web
```

**Limpar espaço:**
```bash
docker system prune -a
docker volume prune
```

---

**✅ Resultado Final:**
- API: https://api.ivillar.com.br ✅
- Frontend: https://ivillar.com.br 🚀 (novo)
- Ambos rodando na mesma VPS
