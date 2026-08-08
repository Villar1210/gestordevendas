# Deploy — Gestor de Vendas CRM

## Arquitetura de produção

```
Internet
   │
   ▼
Cloudflare (opcional, CDN + proteção DDoS)
   │
   ▼
Nginx (443/SSL)
 ├─ api.gestordevendas.com.br → localhost:8000 (FastAPI)
 └─ gestordevendas.com.br    → localhost:3000 (Next.js)
   │
   ├─ Docker: api + worker + worker_embed + beat
   └─ Docker: redis
```

## Setup inicial do VPS (uma vez)

```bash
# 1. Conectar no VPS
ssh root@<IP_DO_VPS>

# 2. Rodar setup
wget https://raw.githubusercontent.com/seuusuario/gestordevendas-api/main/deploy/setup-vps.sh
chmod +x setup-vps.sh && bash setup-vps.sh

# 3. Clonar o projeto
cd /opt/gestordevendas-api
git clone https://github.com/seuusuario/gestordevendas-api.git .

# 4. Configurar .env
cp .env.example .env
nano .env   # preencher todas as variáveis

# 5. Configurar Nginx
cp deploy/nginx.conf /etc/nginx/sites-available/gestordevendas
ln -s /etc/nginx/sites-available/gestordevendas /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 6. SSL com Let's Encrypt
certbot --nginx -d api.gestordevendas.com.br
certbot --nginx -d gestordevendas.com.br

# 7. Subir os serviços
docker compose up -d

# 8. Aplicar schema SQL no Supabase
# Acessar: supabase.com -> SQL Editor -> colar supabase/migrations/001_initial_schema.sql
```

## Secrets do GitHub Actions

Configurar em: Settings → Secrets and variables → Actions

| Secret              | Descrição                                        |
|---------------------|--------------------------------------------------|
| `VPS_HOST`          | IP ou hostname do VPS                            |
| `VPS_USER`          | Usuário SSH (ex: ubuntu)                         |
| `VPS_SSH_KEY`       | Chave SSH privada para deploy                    |
| `SUPABASE_JWT_SECRET` | JWT Secret do Supabase (para testes de CI)     |
| `ENCRYPTION_KEY`    | Fernet key (para testes de CI)                   |

## Deploy manual

```bash
cd /opt/gestordevendas-api
IMAGE_TAG=latest ./deploy/deploy.sh
```

## Comandos úteis

```bash
# Ver logs da API
docker compose logs -f api

# Ver logs dos workers
docker compose logs -f worker worker_embed

# Reiniciar um serviço
docker compose restart worker

# Status dos serviços
docker compose ps

# Health check
curl http://localhost:8000/health

# Health detalhado
curl http://localhost:8000/health/detailed
```

## Checklist pré-deploy (interação necessária)

- [ ] Supabase: projeto criado + schema aplicado (`001_initial_schema.sql`)
- [ ] Supabase: pgvector habilitado (Dashboard → Database → Extensions → vector)
- [ ] Supabase: primeiro usuário criado manualmente (Authentication → Users)
- [ ] Meta: App criado no developers.facebook.com com WhatsApp Business API
- [ ] Stripe: conta criada, produtos e preços configurados, webhook endpoint cadastrado
- [ ] Domínio: DNS configurado apontando para o IP do VPS
- [ ] VPS: setup-vps.sh executado
- [ ] VPS: .env preenchido com todos os valores reais
- [ ] SSL: certbot executado com sucesso para ambos os domínios
- [ ] GitHub Secrets: todos os secrets configurados
