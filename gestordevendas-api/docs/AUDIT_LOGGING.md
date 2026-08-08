# Audit Logging — Documentação

> **Log automático de todas as ações críticas com rastreabilidade completa**

## 📋 Visão Geral

O sistema de **Audit Logging** garante que:

1. ✅ Toda ação crítica é registrada automaticamente
2. ✅ Registro vinculado com request_id
3. ✅ Rastreamento de ator (user_id, email, role)
4. ✅ IP e User-Agent capturados
5. ✅ Sucesso/falha registrados
6. ✅ Recurso afetado identificado

## 🎯 Ações Auditadas

### Super Admin
- `super_admin_list_tenants` — Listar todos os tenants
- `super_admin_get_stats` — Obter estatísticas globais
- `super_admin_assume_tenant` — Assumir admin de tenant

### Autenticação
- `auth_login` — Login de usuário
- `auth_logout` — Logout de usuário
- `auth_token_refresh` — Renovação de token

### Contatos
- `contact_create` — Criar contato
- `contact_update` — Atualizar contato
- `contact_delete` — Deletar contato
- `contact_bulk_import` — Importação em massa

### Campanhas
- `campaign_create` — Criar campanha
- `campaign_update` — Atualizar campanha
- `campaign_delete` — Deletar campanha
- `campaign_launch` — Lançar campanha

### Leads
- `lead_create` — Criar lead
- `lead_update` — Atualizar lead
- `lead_delete` — Deletar lead
- `lead_convert` — Converter lead

### Configurações
- `settings_update` — Atualizar configurações
- `user_create` — Criar usuário
- `user_delete` — Deletar usuário

## 💻 Uso com Decorador

### Básico

```python
from app.core.audit_logging import audit_action, AuditAction

class ContactRepository:
    @audit_action(
        AuditAction.CONTACT_CREATE,
        resource_type="contact"
    )
    async def create(self, contact_data: ContactData) -> Contact:
        # Criar contato...
        return contact
```

### Com extração de Resource ID

```python
@audit_action(
    AuditAction.CONTACT_DELETE,
    resource_type="contact",
    extract_resource_id=lambda result, args, kwargs: args[1]  # contact_id
)
async def delete(self, tenant_id: str, contact_id: str) -> None:
    # Deletar contato...
```

### Em Endpoints

```python
from app.core.audit_logging import audit_action, AuditAction

@app.post("/contacts")
@audit_action(
    AuditAction.CONTACT_CREATE,
    resource_type="contact",
)
async def create_contact(data: ContactData):
    contact = await repo.create(data)
    return contact
```

## 📊 Estrutura do Log

```python
AuditLogEntry {
    # Identificadores
    request_id: str                  # Vinculado com requisição
    action: AuditAction              # Tipo de ação
    timestamp: datetime              # Quando aconteceu

    # Ator
    actor_id: str                    # user_id
    actor_email: str                 # Email do usuário
    actor_role: str                  # Role (admin, agent, etc)
    actor_ip: Optional[str]          # IP do cliente
    actor_user_agent: Optional[str]  # User-Agent do navegador

    # Contexto
    tenant_id: Optional[str]         # Tenant afetado
    resource_type: Optional[str]     # "contact", "campaign", etc
    resource_id: Optional[str]       # ID do recurso
    action_details: Dict             # Parâmetros da ação

    # Resultado
    success: bool                    # Sucesso ou falha
    error_message: Optional[str]     # Mensagem de erro
}
```

## 🔍 Exemplos de Logs

### Sucesso

```
[req-a1b2c3] ✅ SUCCESS contact_create by user@example.com on contact:contact-123
```

### Falha

```
[req-d4e5f6] ❌ FAILED contact_delete by admin@example.com on contact:contact-456
Error: Contact not found
```

## 🔐 Segurança

### O que é registrado:

✅ Quem (user_id, email, role)  
✅ O quê (ação, recurso)  
✅ Quando (timestamp, request_id)  
✅ De onde (IP, User-Agent)  
✅ Resultado (sucesso/falha)  

### O que NÃO é registrado:

❌ Senhas  
❌ Tokens  
❌ Dados sensíveis (SSN, cartão de crédito)  
❌ Conteúdo de campos privados  

## 📈 Queries Úteis

### Auditar Super Admin

```python
logger = get_audit_logger()
entries = logger.get_entries(actor_id="super-admin-123")
# Ver todas ações do Super Admin
```

### Auditar Tenant

```python
# Em produção (banco de dados):
# SELECT * FROM audit_logs 
# WHERE tenant_id = 'tenant-xyz'
# ORDER BY timestamp DESC
```

### Auditar Recurso

```python
# Em produção:
# SELECT * FROM audit_logs
# WHERE resource_type = 'contact' 
# AND resource_id = 'contact-123'
```

### Auditar Falhas

```python
# Em produção:
# SELECT * FROM audit_logs
# WHERE success = false
# ORDER BY timestamp DESC
```

## 🧪 Testes

```bash
# Rodar testes de auditoria
pytest tests/core/test_audit_logging.py -v

# 12 testes validam:
# - Criação de log entries
# - Enum de ações
# - Armazenamento de logs
# - Rastreamento de recurso
# - Metadados de contexto
# - Filtragem por ator
```

## 🚀 Produção

### Armazenar no Banco

```python
# Em audit_logging.py, função log():

async def log(self, entry: AuditLogEntry) -> None:
    # Salvar no banco
    await db.create(AuditLogRecord, {
        "request_id": entry.request_id,
        "action": entry.action.value,
        "actor_id": entry.actor_id,
        "actor_email": entry.actor_email,
        "actor_role": entry.actor_role,
        "actor_ip": entry.actor_ip,
        "actor_user_agent": entry.actor_user_agent,
        "tenant_id": entry.tenant_id,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "action_details": entry.action_details,
        "success": entry.success,
        "error_message": entry.error_message,
        "timestamp": entry.timestamp,
    })
```

### Índices Recomendados

```sql
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

---

**Versão:** 1.0.0  
**Última atualização:** 2026-08-08
