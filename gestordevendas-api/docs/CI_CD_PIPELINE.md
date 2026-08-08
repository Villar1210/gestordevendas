# CI/CD Pipeline — GitHub Actions

> **Fase 20: Automação completa de testes e deploy**

---

## 🔄 Pipeline Overview

```
┌─────────────┐
│   Git Push  │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  CI Pipeline         │
├──────────────────────┤
│ ✓ Tests              │
│ ✓ Lint               │
│ ✓ Security scan      │
│ ✓ Docker build       │
└──────────┬───────────┘
           │
       ✅ All pass?
           │
    ┌──────▼──────┐
    │   Staging   │
    │   Deploy    │
    └──────┬──────┘
           │
       ✅ Smoke tests?
           │
    ┌──────▼──────────┐
    │   Production    │
    │   Deploy        │
    └────────────────┘
```

---

## 📋 CI Pipeline (Testes)

**Trigger:** Push em `main` ou `develop`, Pull Requests

**Jobs:**

### 1️⃣ Tests
- Setup: Python 3.11 + PostgreSQL + Redis
- Migrations Alembic
- Run pytest com coverage
- Upload para Codecov

### 2️⃣ Lint & Format
- Black (code formatting)
- isort (import sorting)
- Flake8 (linting)
- MyPy (type checking)

### 3️⃣ Security Scan
- Bandit (security vulnerabilities)
- Safety (dependency vulnerabilities)

### 4️⃣ Docker Build
- Build image multi-stage
- Cache com GitHub Actions

---

## 🚀 CD Pipeline (Deploy)

**Trigger:** Merge em `main` após CI passar

**Environments:**

### Staging
- Servidor: `staging-api.ivillar.com.br`
- Auto-deploy após CI
- Smoke tests automáticos
- Notificação Slack

### Production
- Servidor: `api.ivillar.com.br`
- Manual approval (environment setting)
- Zero-downtime via Nginx
- Backup pré-deploy
- Smoke tests
- Rollback automático se falhar
- Notificação Slack

---

## 📊 GitHub Secrets Necessários

```
# SSH para Staging
STAGING_HOST           = staging.server.com
STAGING_USER           = deploy
STAGING_SSH_KEY        = -----BEGIN OPENSSH PRIVATE KEY-----...

# SSH para Produção
PROD_HOST              = prod.server.com
PROD_USER              = deploy
PROD_SSH_KEY           = -----BEGIN OPENSSH PRIVATE KEY-----...

# Notificações
SLACK_WEBHOOK          = https://hooks.slack.com/services/...
```

### Setup no GitHub

1. Repository Settings → Secrets and variables → Actions
2. Add secrets (não versiona)
3. Add environment (adiciona aprovação manual)

---

## 🛠️ Configuração Local

### .github/workflows/ci.yml

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    # Corre testes
  lint:
    # Valida formato
  security:
    # Scans de segurança
  docker-build:
    # Build Docker
```

### .github/workflows/cd.yml

```yaml
on:
  push:
    branches: [main]  # Só main vai para prod

jobs:
  deploy-staging:
    # Deploy automático
  deploy-production:
    # Deploy com aprovação
```

---

## 🧪 Smoke Tests

Arquivo: `tests/smoke/test_health.py`

```python
import pytest
import requests

def test_api_health(base_url):
    """Verificar que API está respondendo."""
    response = requests.get(f"{base_url}/api/health")
    assert response.status_code == 200

def test_auth_login(base_url):
    """Testar login."""
    response = requests.post(f"{base_url}/auth/login", json={
        "email": "test@example.com",
        "password": "test"
    })
    assert response.status_code in [200, 401]

def test_contacts_list(base_url, auth_token):
    """Testar listagem de contatos."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.get(f"{base_url}/api/contacts", headers=headers)
    assert response.status_code == 200
```

---

## 📈 Monitoramento

### Status das Workflows

```
GitHub Actions → Repository → Actions → Workflows
```

### Badges no README

```markdown
[![CI](https://github.com/org/repo/workflows/CI/badge.svg)](https://github.com/org/repo/actions)
[![Coverage](https://codecov.io/gh/org/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/org/repo)
```

---

## 🔄 Rollback em Produção

Se deploy falhar:

1. **Automático:** Rollback via `git checkout HEAD~1`
2. **Manual:** Revert via GitHub web UI
3. **SSH:** `cd /opt/deskcomm && git revert && docker-compose up -d`

---

## 📋 Checklist de Deploy

- [ ] Todos os testes passando (CI verde)
- [ ] Code review aprovado (2+ reviewers)
- [ ] Merge em main
- [ ] Deploy em staging automático
- [ ] Smoke tests passando
- [ ] Approve produção (environment setting)
- [ ] Deploy em produção automático
- [ ] Monitorar alertas por 30 min
- [ ] Notificação Slack confirmada

---

## 🚨 Troubleshooting

### Tests falhando
```bash
# Rodar localmente
pytest tests/ -v
pytest tests/smoke/ -v --base-url=http://localhost:8000
```

### Lint errors
```bash
black app/
isort app/
flake8 app/
```

### Deploy falhando
```bash
# SSH para servidor
ssh -i ~/.ssh/prod_key deploy@prod.server.com
cd /opt/deskcomm
docker-compose logs backend
```

---

**Versão:** 1.0.0  
**Status:** Production Ready  
**Deployment Frequency:** Multiple times per day
