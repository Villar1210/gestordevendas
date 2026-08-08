# Request Context Propagation — Documentação

> **Propagar contexto de tenant e usuário automaticamente em todas as requisições**

## 📋 Visão Geral

O sistema de **Request Context Propagation** garante que:

1. ✅ Toda requisição HTTP tem um contexto disponível
2. ✅ O contexto contém informações de tenant, usuário e permissões
3. ✅ Repositories e serviços podem acessar o contexto automaticamente
4. ✅ Não há necessidade de passar tenant_id manualmente entre camadas
5. ✅ Isolamento de dados é automático

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Request                           │
├─────────────────────────────────────────────────────────────┤
│                  Authentication Middleware                  │
│         (valida JWT, extrai user_id, role, account_id)     │
├─────────────────────────────────────────────────────────────┤
│            RequestContextMiddleware                          │
│     (popula RequestContext com informações de auth)         │
├─────────────────────────────────────────────────────────────┤
│                   Endpoint Handler                           │
│  (pode acessar contexto via get_context(), get_tenant_id()) │
├─────────────────────────────────────────────────────────────┤
│                    Repository Layer                          │
│  (queries são filtradas automaticamente por tenant_id)      │
├─────────────────────────────────────────────────────────────┤
│                   Database                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Componentes

### 1. RequestContext (app/core/context.py)

```python
@dataclass
class RequestContext:
    request_id: str              # UUID para rastreamento
    user_id: str                 # ID do usuário
    email: str                   # Email do usuário
    tenant_id: Optional[str]     # account_id (None para Super Admin cross-tenant)
    role: str                    # "viewer", "agent", "owner", "admin", "super_admin"
    is_super_admin: bool         # True se role == "super_admin"
    timestamp: datetime          # Quando a requisição começou
    ip_address: Optional[str]    # IP do cliente
    user_agent: Optional[str]    # User Agent do navegador
```

### 2. RequestContextMiddleware (app/core/middleware/context_middleware.py)

Executa após autenticação e popula o contexto automaticamente:

```python
app.add_middleware(RequestContextMiddleware)
```

### 3. Context Getters (app/core/context.py)

Funções para acessar contexto em qualquer lugar do código:

```python
get_context()           # Retorna RequestContext completo
get_tenant_id()         # Retorna tenant_id da requisição
get_user_id()           # Retorna user_id da requisição
get_request_id()        # Retorna request_id (para logs)
get_is_super_admin()    # Retorna boolean
get_role()              # Retorna role do usuário
```

## 💡 Exemplos de Uso

### 1. Em Endpoints (FastAPI)

```python
from fastapi import APIRouter
from app.core.context import get_tenant_id, get_context

router = APIRouter()

@router.get("/contacts")
async def list_contacts():
    """Listar contatos do tenant atual."""
    tenant_id = get_tenant_id()
    
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Sem tenant")
    
    # Buscar contatos do tenant
    contacts = await get_contacts_repo().list_by_tenant(tenant_id)
    return {"contacts": contacts}
```

### 2. Em Repositories

```python
from app.core.context import get_tenant_id, get_is_super_admin

class ContactRepository:
    async def list_all(self):
        """Listar contatos com isolamento automático."""
        tenant_id = get_tenant_id()
        is_super_admin = get_is_super_admin()
        
        query = db.query(Contact)
        
        # Super Admin vê tudo
        if not is_super_admin:
            query = query.filter(Contact.account_id == tenant_id)
        
        return query.all()
    
    async def get_by_id(self, contact_id: str):
        """Buscar contato com validação de tenant."""
        tenant_id = get_tenant_id()
        
        contact = db.query(Contact).filter(
            Contact.id == contact_id,
            Contact.account_id == tenant_id,  # Isolamento automático
        ).first()
        
        if not contact:
            raise NotFoundError(f"Contato {contact_id} não encontrado")
        
        return contact
```

### 3. Em Serviços

```python
from app.core.context import get_context, assert_tenant_access

class EmailService:
    async def send_campaign(self, campaign_id: str):
        """Enviar campanha com validação de acesso."""
        ctx = get_context()
        
        # Buscar campanha
        campaign = await get_campaign_repo().get_by_id(campaign_id)
        
        # Validar acesso ao tenant da campanha
        assert_tenant_access(campaign.account_id)
        
        # Enviar emails
        await self.send_emails(campaign)
```

### 4. Logging com Request ID

```python
from app.core.context import get_request_id
import logging

logger = logging.getLogger(__name__)

async def process_contact(contact_id: str):
    request_id = get_request_id()
    logger.info(
        f"[{request_id}] Processando contato {contact_id}",
        extra={"request_id": request_id}
    )
    # ... processar ...
```

### 5. Auditoria

```python
from app.core.context import get_context
from datetime import datetime

class AuditLog:
    @staticmethod
    async def log_action(action: str, details: dict):
        """Registrar ação na auditoria com contexto completo."""
        ctx = get_context()
        
        await db.create(AuditLogRecord, {
            "request_id": ctx.request_id,
            "super_usuario_id": ctx.user_id,
            "account_id": ctx.tenant_id,
            "acao": action,
            "detalhes": json.dumps(details),
            "ip_address": ctx.ip_address,
            "user_agent": ctx.user_agent,
            "created_at": ctx.timestamp,
        })
```

## 🔒 Segurança

### Isolamento Garantido

```python
# Super Admin pode acessar qualquer tenant
super_admin_context.can_access_tenant("any-tenant-id")  # → True

# Usuário regular só acessa seu tenant
user_context.can_access_tenant("seu-tenant")   # → True
user_context.can_access_tenant("outro-tenant") # → False
```

### Rastreabilidade Completa

Cada requisição tem um `request_id` único que pode ser rastreado:

```
2026-08-08T15:30:45.123456 [a1b2c3d4-e5f6-...] User: user-123, Tenant: tenant-a
  → GET /api/contacts
  → SELECT * FROM contacts WHERE account_id='tenant-a'
  → Response: 42 contacts
```

## 🧪 Testes

```bash
# Rodar testes de context
pytest tests/core/test_request_context.py -v

# 8 testes validam:
# - Criação de contexto
# - Super Admin vs usuário regular
# - Validação de acesso por tenant
# - Geração de request_id
# - Timestamps
# - Todos os roles
```

## ⚙️ Configuração

### 1. Registrar Middleware no FastAPI

```python
# app/main.py
from fastapi import FastAPI
from app.core.middleware.context_middleware import RequestContextMiddleware

app = FastAPI()

# Registrar middleware APÓS auth middleware
# A ordem é importante!
app.add_middleware(RequestContextMiddleware)
```

### 2. Usar em Qualquer Lugar

```python
# Endpoint
from app.core.context import get_tenant_id

@app.get("/data")
async def get_data():
    tenant_id = get_tenant_id()
    # ...

# Repository
from app.core.context import get_tenant_id

class MyRepo:
    def list_items(self):
        tenant_id = get_tenant_id()
        # ...

# Service
from app.core.context import get_context

class MyService:
    def do_something(self):
        ctx = get_context()
        # ...
```

## 📊 Header de Rastreamento

A resposta inclui o `X-Request-ID` para rastreamento:

```bash
# Request
GET /api/contacts
Authorization: Bearer ...

# Response
HTTP/1.1 200 OK
X-Request-ID: a1b2c3d4-e5f6-4789-ac12-def0123456789
Content-Type: application/json

{
  "contacts": [...]
}
```

Usar este ID em logs para rastrear a requisição completa.

## 🚀 Boas Práticas

✅ **Fazer:**
- Usar `get_tenant_id()` em repositories
- Usar `get_context()` para acessar informações completas
- Usar `get_request_id()` em logs
- Validar com `assert_tenant_access()` quando apropriado

❌ **Não fazer:**
- Passar `tenant_id` manualmente entre camadas
- Armazenar contexto em variáveis globais
- Acessar contexto em código que pode ser chamado fora de uma requisição
- Confiar em `request.state` diretamente (usar helpers)

## 🔍 Troubleshooting

### Contexto é None

```python
ctx = get_context()
if ctx is None:
    # Possíveis razões:
    # 1. Endpoint é público (sem auth)
    # 2. Middleware não foi registrado
    # 3. Código está rodando fora de uma requisição HTTP
```

### Tenant_id é None para usuário regular

```python
# Usuário precisa ter um account_id no perfil
# Verificar: profiles.account_id é NOT NULL
```

### Request_id não aparece nos logs

```python
# Adicionar ao formatter do logger:
logging.basicConfig(
    format='[%(request_id)s] %(message)s',
    # ...
)
```

## 📚 Referências

- [FastAPI Middleware](https://fastapi.tiangolo.com/tutorial/middleware/)
- [Python ContextVar](https://docs.python.org/3/library/contextvars.html)
- [Request Context Pattern](https://12factor.net/logs)

---

**Versão:** 1.0.0  
**Última atualização:** 2026-08-08
