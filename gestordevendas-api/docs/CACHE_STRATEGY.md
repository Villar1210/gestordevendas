# Cache Strategy — Performance Optimization

> **Fase 17: Estratégia de cache com Redis para 10x performance**

---

## 📊 Overview

```
sem cache:  100 queries × 100ms = 10.000ms (10 segundos)
com cache:  1 query × 100ms + cache hits = 100ms (0.1 segundos)

SPEEDUP: 100x em casos ideais
```

---

## 🎯 TTL por Recurso

| Recurso | TTL | Razão |
|---------|-----|-------|
| Account | 5 min | Mudanças raras (plano, status) |
| Profile | 5 min | Dados de usuário estáveis |
| Contact | 1 min | Dados dinâmicos (tags, status) |
| Lead | 2 min | Dados de vendas dinâmicos |
| Conversation | 30s | Atualizações frequentes |
| List | 2-5 min | Dependem do tipo |

---

## 💻 Uso

### Decorator Automático

```python
from app.core.cache import cached, cache_contact

@cached(
    key_builder=lambda contact_id: cache_contact(contact_id),
    ttl=60
)
async def get_contact(contact_id: str):
    return await ContactsRepository().get(contact_id)
```

### Manual

```python
from app.core.cache import CacheManager, CacheConfig

# Get
contact = CacheManager.get(cache_contact("123"))

# Set
CacheManager.set(cache_contact("123"), contact_data, CacheConfig.CONTACT_TTL)

# Delete
CacheManager.delete(cache_contact("123"))

# Invalidate by pattern
CacheManager.delete_pattern("contact:*:tenant:tenant-a")

# Invalidate entire tenant
CacheManager.invalidate_tenant("tenant-a")
```

---

## 🔄 Invalidação

### Por Recurso

```python
# Ao atualizar um contact
contact = await update_contact(contact_id, data)

# Invalidar cache do contact
CacheManager.delete(cache_contact(contact_id))

# Invalidar lista de contacts do tenant
CacheManager.delete(cache_contacts_list(tenant_id))
```

### Por Tenant

```python
# Ao mudar plan do account
account = await update_account(account_id, plan="pro")

# Invalidar TUDO de um tenant
CacheManager.invalidate_tenant(account.tenant_id)
```

### Padrões

```python
# Deletar múltiplas chaves
CacheManager.delete_pattern("contact:*:tenant:tenant-a")

# Deletar por padrão complexo
CacheManager.delete_pattern("profile:*:status:inactive")
```

---

## 📈 Database Indexes

Críticos para performance mesmo com cache:

```sql
-- Já executados em indexes.sql

-- Buscar by status (listagem)
CREATE INDEX idx_contacts_tenant_status
ON contacts(account_id, status, created_at DESC);

-- Buscar por email (login)
CREATE INDEX idx_profiles_email_unique
ON profiles(email)
WHERE deleted_at IS NULL;

-- Filtros complexos
CREATE INDEX idx_leads_score
ON leads(score DESC, account_id)
WHERE score > 0;
```

Executar:
```bash
docker exec deskcomm_postgres psql -U deskcomm -d ivillar_crm -f indexes.sql
```

---

## 🌡️ Monitoramento

### Stats de Cache

```python
from app.core.cache import cache_stats

stats = cache_stats.get_stats()
# {
#   "hits": 1000,
#   "misses": 50,
#   "hit_rate": 95.2%,
#   "redis_memory": "256MB",
#   "redis_connected_clients": 5
# }
```

### Endpoint de Stats

```python
@router.get("/api/internal/cache/stats")
async def get_cache_stats(current_user = Depends(require_super_admin)):
    return cache_stats.get_stats()
```

---

## 🚀 Warm-up

Executar na inicialização:

```python
from app.core.cache import warmup_cache

@app.on_event("startup")
async def startup():
    await warmup_cache()
```

Pré-carrega dados frequentemente acessados.

---

## 🧪 Testes

```bash
# Testes de cache
pytest tests/core/test_cache_performance.py -v

# 9 testes verificam:
# - Set/Get básico
# - Delete
# - TTL expiration
# - Pattern invalidation
# - Tenant invalidation
# - Stats
# - Decorator
# - None handling
# - Multi-level cache
```

---

## 📋 Checklist de Deploy

- [ ] Redis em produção (docker-compose)
- [ ] Índices SQL criados
- [ ] Testes de cache passando
- [ ] Warm-up implementado
- [ ] Monitoramento de stats
- [ ] TTL configurado
- [ ] Invalidation strategy definida
- [ ] Logs de cache operacional

---

**Versão:** 1.0.0  
**Hit Rate Target:** 85%+  
**Performance Target:** 10x speedup
