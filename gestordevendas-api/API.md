# Gestor de Vendas CRM — Documentação da API

**Versão:** 1.0.0  
**Servidor Base:** `https://api-gestordevendas.com.br`  
**Documentação Interativa:** `/api/docs` (Swagger UI)

---

## 📚 Endpoints Implementados (Semana 2)

### 1️⃣ Message Templates (Task 1)

#### Criar Template
```http
POST /api/templates
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Saudação Inicial",
  "description": "Mensagem de boas-vindas ao contato",
  "content": "Olá {{name}}, bem-vindo!",
  "category": "greeting",
  "tags": ["boas-vindas", "inicial"]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "account_id": "uuid",
  "name": "Saudação Inicial",
  "content": "Olá {{name}}, bem-vindo!",
  "category": "greeting",
  "usage_count": 0,
  "created_at": "2026-08-11T10:30:00Z",
  "updated_at": "2026-08-11T10:30:00Z"
}
```

#### Listar Templates
```http
GET /api/templates?limit=20&offset=0
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "templates": [...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

#### Obter Template
```http
GET /api/templates/{id}
Authorization: Bearer {token}
```

#### Atualizar Template
```http
PATCH /api/templates/{id}
Authorization: Bearer {token}

{
  "name": "Saudação Atualizada",
  "content": "Oi {{name}}!"
}
```

#### Deletar Template
```http
DELETE /api/templates/{id}
Authorization: Bearer {token}
```

#### Aplicar Template
```http
POST /api/templates/{id}/apply
Authorization: Bearer {token}

{
  "contact_id": "uuid",
  "variables": {"name": "João"}
}
```

---

### 2️⃣ Kanban Order Persistence (Task 2)

#### Atualizar Ordem de Um Card
```http
PATCH /api/cards/{card_id}/order
Authorization: Bearer {token}

{
  "new_position": 5
}
```

#### Reordenar Multiple Cards
```http
PATCH /api/cards/reorder
Authorization: Bearer {token}

{
  "reorder": [
    {"card_id": "uuid1", "new_position": 1},
    {"card_id": "uuid2", "new_position": 2},
    {"card_id": "uuid3", "new_position": 3}
  ]
}
```

---

### 3️⃣ Knowledge Base Search (Task 3)

#### Criar Base de Conhecimento
```http
POST /api/knowledge
Authorization: Bearer {token}

{
  "title": "Como integrar WhatsApp",
  "content": "Acesse Configurações > Integrações...",
  "category": "integration"
}
```

#### Buscar Conhecimento
```http
POST /api/knowledge/search
Authorization: Bearer {token}

{
  "query": "Como conectar WhatsApp",
  "limit": 5
}
```

**Response (200):**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Como integrar WhatsApp",
      "content": "...",
      "similarity_score": 0.95,
      "category": "integration"
    }
  ],
  "query": "Como conectar WhatsApp",
  "total": 1
}
```

#### Obter Conhecimento
```http
GET /api/knowledge/{id}
Authorization: Bearer {token}
```

---

### 4️⃣ Metrics & Analytics (Task 4)

#### Obter KPIs
```http
GET /api/metrics/kpi?start_date=2026-08-01&end_date=2026-08-11
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "kpis": [
    {
      "name": "total_leads",
      "value": 42,
      "change_percent": 15.5
    }
  ],
  "summary": {
    "total": 42,
    "new_this_period": 10
  },
  "period_start": "2026-08-01",
  "period_end": "2026-08-11"
}
```

#### Obter Tendências
```http
GET /api/metrics/trends/card_created?start_date=2026-08-01&end_date=2026-08-11
Authorization: Bearer {token}
```

#### Obter Métricas de Equipe
```http
GET /api/metrics/team?start_date=2026-08-01&end_date=2026-08-11
Authorization: Bearer {token}
```

---

### 5️⃣ Settings Module (Task 5)

#### Obter Configurações
```http
GET /api/settings/
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "id": "uuid",
  "account_id": "uuid",
  "general": {
    "company_name": "Minha Imobiliária",
    "company_logo_url": "https://...",
    "theme": "light",
    "language": "pt-BR",
    "timezone": "America/Sao_Paulo"
  },
  "features": {
    "enable_whatsapp": true,
    "enable_email": true,
    "enable_sms": false,
    "enable_analytics": true,
    "enable_ai": false
  },
  "quota": {
    "max_users": 10,
    "max_contacts": 1000,
    "max_storage_gb": 5
  },
  "notifications": {
    "notify_new_lead": true,
    "notify_deal_won": true,
    "notify_team_activity": false
  },
  "security": {
    "require_2fa": false,
    "api_key_rotation_days": 90,
    "session_timeout_minutes": 60
  },
  "created_at": "2026-08-11T10:30:00Z",
  "updated_at": "2026-08-11T10:30:00Z"
}
```

#### Atualizar Configurações
```http
PATCH /api/settings/
Authorization: Bearer {token}

{
  "general": {
    "company_name": "Nova Imobiliária",
    "theme": "dark"
  },
  "features": {
    "enable_ai": true
  }
}
```

---

## 🔐 Autenticação

Todos os endpoints requerem um **JWT Bearer Token** no header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Obtenha o token fazendo login via endpoint de autenticação (não documentado aqui).

---

## 📊 Status Codes

| Code | Significado |
|------|------------|
| 200 | OK — Requisição bem-sucedida |
| 201 | Created — Recurso criado |
| 204 | No Content — Sucesso, sem body |
| 400 | Bad Request — Erro na validação |
| 401 | Unauthorized — Token inválido/expirado |
| 403 | Forbidden — Acesso negado |
| 404 | Not Found — Recurso não encontrado |
| 429 | Too Many Requests — Rate limit excedido |
| 500 | Internal Server Error — Erro do servidor |

---

## ⚡ Rate Limiting

Os endpoints têm rate limits por categoria:

| Endpoint | Limite |
|----------|--------|
| POST /templates | 30/minuto |
| GET /templates | 60/minuto |
| POST /knowledge/search | 60/minuto |
| GET /metrics/* | 60/minuto |
| PATCH /settings | 30/minuto |

Quando limite é excedido, receba:

```http
HTTP/1.1 429 Too Many Requests

{
  "detail": "Too many requests. Please try again later."
}
```

---

## 📝 Exemplos com cURL

### Criar Template
```bash
curl -X POST https://api-gestordevendas.com.br/api/templates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Saudação",
    "content": "Olá!",
    "category": "greeting"
  }'
```

### Buscar Conhecimento
```bash
curl -X POST https://api-gestordevendas.com.br/api/knowledge/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "WhatsApp",
    "limit": 5
  }'
```

### Obter Settings
```bash
curl -X GET https://api-gestordevendas.com.br/api/settings/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🧪 Teste a API

Acesse a documentação interativa em:
- **Swagger UI:** `/api/docs`
- **ReDoc:** `/api/redoc`

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação: `/api/docs`
2. Abra uma issue no GitHub
3. Entre em contato com o time de suporte
