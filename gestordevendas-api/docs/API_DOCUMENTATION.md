# API Documentation — OpenAPI/Swagger

> **Fase 19: Documentação completa e interativa da API**

---

## 🚀 Acesso à Documentação

```
Interactive Swagger UI:  http://localhost:8000/docs
ReDoc:                   http://localhost:8000/redoc
OpenAPI JSON:            http://localhost:8000/openapi.json
```

---

## 🔐 Autenticação

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "senha123"
}
```

**Response:**
```json
{
  "user": {
    "id": "profile-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  }
}
```

JWT salvo automaticamente em cookie httpOnly.

### Usar Token

```http
GET /api/leads
Authorization: Bearer eyJhbGc...
```

---

## 📋 Endpoints Principais

### Autenticação

| Method | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/login` | Login com email/senha |
| POST | `/auth/logout` | Logout e invalidar token |
| POST | `/auth/refresh` | Renovar token expirado |
| GET | `/auth/me` | Dados do usuário atual |

### Contacts (CRM)

| Method | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/contacts` | Listar contatos | Sim |
| POST | `/api/contacts` | Criar contato | Sim |
| GET | `/api/contacts/{id}` | Obter contato | Sim |
| PUT | `/api/contacts/{id}` | Atualizar contato | Sim |
| DELETE | `/api/contacts/{id}` | Deletar contato | Sim |
| POST | `/api/contacts/{id}/tags` | Adicionar tags | Sim |

### Leads

| Method | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/leads` | Listar leads | Sim |
| POST | `/api/leads` | Criar lead | Sim |
| GET | `/api/leads/{id}` | Obter lead | Sim |
| PUT | `/api/leads/{id}` | Atualizar lead | Sim |
| DELETE | `/api/leads/{id}` | Deletar lead | Sim |
| POST | `/api/leads/{id}/move` | Mover para stage | Sim |

### Conversations (Omnichannel)

| Method | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/conversations` | Listar conversas | Sim |
| GET | `/api/conversations/{id}` | Obter conversa | Sim |
| GET | `/api/conversations/{id}/messages` | Listar mensagens | Sim |
| POST | `/api/conversations/{id}/messages` | Enviar mensagem | Sim |

### Super Admin (Cross-Tenant)

| Method | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/super/dashboard` | Dashboard global | Super Admin |
| GET | `/api/super/tenants` | Listar tenants | Super Admin |
| POST | `/api/super/tenants/{id}/assume-admin` | Assumir admin de tenant | Super Admin |

---

## 📝 Exemplos de Uso

### Criar Lead

```python
import requests

url = "https://api.ivillar.com.br/api/leads"
headers = {
    "Authorization": "Bearer seu-token-jwt"
}
data = {
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "phone": "+55 11 98765-4321",
    "company": "Acme Corporation",
    "stage": "prospecting"
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

### Listar Contatos com Paginação

```python
url = "https://api.ivillar.com.br/api/contacts"
headers = {"Authorization": "Bearer seu-token-jwt"}
params = {
    "page": 1,
    "limit": 50,
    "sort": "created_at",
    "order": "desc"
}

response = requests.get(url, headers=headers, params=params)
data = response.json()

print(f"Total: {data['total']}")
print(f"Pages: {data['pages']}")
print(f"Contacts: {len(data['data'])}")
```

### Buscar Leads por Filtro

```python
url = "https://api.ivillar.com.br/api/leads"
headers = {"Authorization": "Bearer seu-token-jwt"}
params = {
    "stage": "proposal",
    "min_score": 70,
    "assigned_to": "user-id"
}

response = requests.get(url, headers=headers, params=params)
leads = response.json()["data"]
```

### Enviar Mensagem em Conversa

```python
url = "https://api.ivillar.com.br/api/conversations/conv-id/messages"
headers = {
    "Authorization": "Bearer seu-token-jwt",
    "Content-Type": "application/json"
}
data = {
    "body": "Olá! Como posso ajudar?",
    "channel": "whatsapp"  # ou email, sms, etc
}

response = requests.post(url, json=data, headers=headers)
message = response.json()
```

---

## 🔄 Webhooks

### Registrar Webhook

```http
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://seu-servidor.com/webhooks/deskcomm",
  "events": ["lead.created", "lead.updated", "message.received"],
  "secret": "seu-secret-para-validacao"
}
```

### Eventos Disponíveis

- `lead.created` — Lead criado
- `lead.updated` — Lead atualizado
- `lead.deleted` — Lead deletado
- `contact.created` — Contato criado
- `message.received` — Mensagem recebida
- `conversation.closed` — Conversa fechada

### Validar Webhook

Cada webhook inclui header `X-Signature`:

```python
import hmac
import hashlib

def verify_webhook(body: bytes, signature: str, secret: str) -> bool:
    computed = hmac.new(
        secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)
```

---

## 🚦 Rate Limiting

### Limites por Tier

| Tier | Requests/min | Requests/hour |
|------|------|------|
| Viewer | 1000 | 10000 |
| Agent | 1000 | 10000 |
| Admin | 1000 | 10000 |
| Super Admin | Unlimited | Unlimited |

### Headers de Rate Limit

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1630708800
```

### HTTP 429 Response

```json
{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

---

## 🧪 Testes de API

### Com cURL

```bash
# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha"}'

# Listar leads (com token)
curl -X GET http://localhost:8000/api/leads \
  -H "Authorization: Bearer eyJhbGc..."
```

### Com Postman

1. Importar collection em `/postman/Deskcomm.postman_collection.json`
2. Configurar environment com `base_url` e `token`
3. Rodar testes

---

## 🔍 Error Handling

### Formato de Erro

```json
{
  "error": "Invalid tenant access",
  "status_code": 403,
  "details": {
    "tenant_id": "tenant-123",
    "user_id": "user-456"
  },
  "request_id": "req-abc123"
}
```

### Códigos HTTP

| Status | Significado |
|--------|------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validação falhou) |
| 401 | Unauthorized (token inválido) |
| 403 | Forbidden (sem permissão) |
| 404 | Not Found |
| 409 | Conflict (duplicata) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## 📚 Recursos

- [Swagger UI Interativa](/docs)
- [ReDoc](/redoc)
- [OpenAPI JSON](/openapi.json)
- [Postman Collection](/postman/Deskcomm.postman_collection.json)

---

**Versão:** 1.0.0  
**Status:** Production Ready
