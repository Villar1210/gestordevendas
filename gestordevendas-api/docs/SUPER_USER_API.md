# Super Usuário API — Documentação

> **Módulo de administração cross-tenant do Deskcomm**

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [Endpoints](#endpoints)
4. [Exemplos de Uso](#exemplos-de-uso)
5. [Segurança & Auditoria](#segurança--auditoria)
6. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O módulo **Super Usuário** permite que administradores com permissão `SUPER_ADMIN` acessem e gerenciem múltiplos tenants (contas) da plataforma Deskcomm.

**Casos de uso:**
- 📊 Visualizar estatísticas globais da plataforma
- 📋 Listar todos os tenants cadastrados
- 🔐 Assumir controle temporário de um tenant para suporte/debug
- 📝 Auditoria completa de acessos cross-tenant

### Hierarquia de Roles

```
SUPER_ADMIN (5) ← Acesso cross-tenant
    ↓
  ADMIN (3)      ← Acesso a um tenant
    ↓
  OWNER (2)      ← Proprietário da conta
    ↓
  AGENT (1)      ← Agente de vendas
    ↓
  VIEWER (0)     ← Apenas leitura
```

---

## Autenticação

Todos os endpoints requerem:
- **Bearer Token JWT** (válido por 8 horas)
- **Role: SUPER_ADMIN**

```bash
# Header obrigatório:
Authorization: Bearer <JWT_TOKEN>
```

### Obter Token (exemplo)

```bash
# 1. Fazer login na plataforma
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"super-admin@plataforma.local","password":"..."}'

# Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": "user-uuid",
    "email": "super-admin@plataforma.local",
    "role": "super_admin"
  }
}
```

---

## Endpoints

### 1️⃣ GET `/api/super/dashboard`

**Obter estatísticas globais da plataforma**

```bash
GET http://localhost:8000/api/super/dashboard
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "total_accounts": 10,
    "total_profiles": 42,
    "total_contacts": 500,
    "total_conversations": 1200,
    "active_accounts_today": 8,
    "plans_breakdown": {
      "free": 5,
      "pro": 3,
      "enterprise": 2
    },
    "generated_at": "2026-08-08T15:30:45.123456"
  }
}
```

**Erros:**
| Código | Significado |
|--------|-------------|
| 401 | Token inválido ou expirado |
| 403 | Usuário não é Super Admin |

---

### 2️⃣ GET `/api/super/tenants`

**Listar todos os tenants da plataforma**

```bash
GET http://localhost:8000/api/super/tenants?limit=100
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (opcional): Máximo de resultados (default: 1000)

**Response (200 OK):**
```json
{
  "status": "success",
  "count": 2,
  "data": [
    {
      "id": "acc-uuid-1",
      "name": "Empresa A",
      "owner_id": "owner-uuid-1",
      "plan": "pro",
      "created_at": "2026-01-15T10:30:00"
    },
    {
      "id": "acc-uuid-2",
      "name": "Empresa B",
      "owner_id": "owner-uuid-2",
      "plan": "free",
      "created_at": "2026-03-20T14:45:00"
    }
  ]
}
```

**Erros:**
| Código | Significado |
|--------|-------------|
| 401 | Token inválido |
| 403 | Sem permissão Super Admin |

---

### 3️⃣ POST `/api/super/tenants/{account_id}/assume-admin`

**Registrar assunção de controle de um tenant**

```bash
POST http://localhost:8000/api/super/tenants/acc-uuid/assume-admin
Authorization: Bearer <token>
Content-Type: application/json

{
  "expires_in_minutes": 60
}
```

**Request Body:**
- `expires_in_minutes` (1-480): Duração da sessão em minutos
  - Mínimo: 1 minuto
  - Máximo: 480 minutos (8 horas)
  - Default: 60 minutos

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "status": "registered",
    "account_id": "acc-uuid",
    "account_name": "Empresa A",
    "account_owner_id": "owner-uuid",
    "account_plan": "pro",
    "assumption_expires_at": "2026-08-08T16:30:45",
    "expires_in_minutes": 60,
    "note": "Este registro foi adicionado à trilha de auditoria.",
    "instructions": {
      "step_1": "Abra uma nova sessão/aba incógnita",
      "step_2": "Acesse https://gestordevendas.ivillar.com.br/login",
      "step_3": "Faça login com uma conta do tenant (ou criada no tenant)",
      "step_4": "Você terá acesso como admin ao tenant especificado",
      "duration": "Seu acesso é registrado e expirará em 60 minutos"
    }
  }
}
```

**Erros:**
| Código | Significado |
|--------|-------------|
| 401 | Token inválido |
| 403 | Sem permissão Super Admin |
| 404 | Tenant não encontrado |
| 422 | `expires_in_minutes` fora do range (1-480) |

---

## Exemplos de Uso

### Python (requests)

```python
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"
TOKEN = "eyJhbGc..."  # Seu JWT token

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

# 1. Obter dashboard
response = requests.get(f"{BASE_URL}/super/dashboard", headers=headers)
stats = response.json()["data"]
print(f"Total de tenants: {stats['total_accounts']}")

# 2. Listar tenants
response = requests.get(f"{BASE_URL}/super/tenants?limit=50", headers=headers)
tenants = response.json()["data"]
for tenant in tenants:
    print(f"- {tenant['name']} ({tenant['plan']})")

# 3. Assumir admin de um tenant
account_id = tenants[0]["id"]
response = requests.post(
    f"{BASE_URL}/super/tenants/{account_id}/assume-admin",
    json={"expires_in_minutes": 120},
    headers=headers,
)
result = response.json()["data"]
print(f"Assunção registrada: {result['account_name']}")
print("Instruções:")
for step, desc in result["instructions"].items():
    print(f"  {step}: {desc}")
```

### cURL

```bash
# 1. Dashboard
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/super/dashboard | jq .

# 2. Listar tenants
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/super/tenants?limit=50" | jq .

# 3. Assumir admin
ACCOUNT_ID="acc-uuid-123"
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"expires_in_minutes":60}' \
  "http://localhost:8000/api/super/tenants/$ACCOUNT_ID/assume-admin" | jq .
```

### JavaScript/TypeScript

```typescript
const BASE_URL = "http://localhost:8000/api";
const token = "eyJhbGc...";

const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json",
};

// 1. Dashboard
const dashResponse = await fetch(`${BASE_URL}/super/dashboard`, { headers });
const stats = (await dashResponse.json()).data;
console.log(`Total accounts: ${stats.total_accounts}`);

// 2. List tenants
const tenantsResponse = await fetch(
  `${BASE_URL}/super/tenants?limit=50`,
  { headers }
);
const tenants = (await tenantsResponse.json()).data;

// 3. Assume admin
const accountId = tenants[0].id;
const assumeResponse = await fetch(
  `${BASE_URL}/super/tenants/${accountId}/assume-admin`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({ expires_in_minutes: 60 }),
  }
);
const result = (await assumeResponse.json()).data;
console.log(`Assumiu: ${result.account_name}`);
console.log(result.instructions);
```

---

## Segurança & Auditoria

### 📝 Trilha de Auditoria

Cada acesso de um Super Usuário é registrado na tabela `acesso_plataforma_logs`:

```sql
SELECT * FROM acesso_plataforma_logs 
WHERE super_usuario_id = 'user-uuid'
ORDER BY created_at DESC;
```

**Campos registrados:**
- `super_usuario_id` — Quem fez a ação
- `account_id` — Tenant acessado (NULL para listar_tenants)
- `account_nome` — Nome legível do tenant
- `acao` — Tipo de ação (listar_tenants, asumir_admin)
- `detalhes` — JSON com dados adicionais
- `created_at` — Timestamp da ação

### 🔒 Limitações por Segurança

- ✅ Apenas roles `SUPER_ADMIN` podem acessar
- ✅ Todos os acessos são auditados
- ✅ JWTs expiram em 8 horas
- ✅ Assunções de admin expiram em 1-480 minutos (configurável)
- ✅ Sem acesso direto a JWTs — Super Admin deve fazer login normalmente

### 🚨 Práticas de Segurança

1. **Nunca compartilhe tokens** — cada Super Admin tem seu próprio token
2. **Use aba incógnita** — ao assumir um tenant, abra em nova sessão
3. **Logout após suporte** — não deixe sessões abertas indefinidamente
4. **Monitore logs de auditoria** — verifique acessos suspeitos regularmente

---

## Troubleshooting

### ❌ "Apenas Super Usuários podem acessar este endpoint"

**Problema:** Seu usuário não tem role `SUPER_ADMIN`.

**Solução:**
1. Verifique o token JWT: `jwt_decode(token)` → campo `role`
2. Se precisar criar um Super Admin:
   ```bash
   python -m app.scripts.seed_super_user
   ```

### ❌ "Token de autenticacao nao fornecido"

**Problema:** Header `Authorization` está faltando ou inválido.

**Solução:**
```bash
# ✅ Correto:
curl -H "Authorization: Bearer eyJhbGc..." http://...

# ❌ Incorreto:
curl -H "Authorization: eyJhbGc..." http://...
curl http://...  # sem header
```

### ❌ "Tenant {id} não encontrado"

**Problema:** O `account_id` não existe.

**Solução:**
1. Listar tenants para pegar IDs corretos:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/super/tenants | jq .data[].id
   ```

### ❌ HTTP 422 (Validation Error)

**Problema:** Dados inválidos no request.

**Exemplo:**
```json
{
  "detail": [
    {
      "loc": ["body", "expires_in_minutes"],
      "msg": "ensure this value is less than or equal to 480",
      "type": "value_error.number.not_le"
    }
  ]
}
```

**Solução:** Verifique os limites:
- `expires_in_minutes`: 1 ≤ valor ≤ 480

---

## 📞 Suporte

Para questões ou bugs:
- 📧 Email: support@deskcomm.local
- 🐛 Issues: https://github.com/seu-org/deskcomm/issues
- 💬 Chat: #deskcomm-support

---

**Última atualização:** 2026-08-08  
**Versão da API:** 1.0.0
