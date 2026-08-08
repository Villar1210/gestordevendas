# Rate Limiting — Documentação

> **Proteção contra abuso de API com rate limiting granular por tenant e endpoint**

## 📋 Visão Geral

O sistema de **Rate Limiting** garante que:

1. ✅ Cada tenant tem limites de requisições separados
2. ✅ Endpoints críticos (DELETE) têm limites mais baixos
3. ✅ Endpoints de leitura (GET) têm limites altos
4. ✅ Super Admin não é limitado
5. ✅ Violações retornam HTTP 429 com instruções

## 📊 Limites por Nível

| Nível | Req/Min | Req/Hora | Uso Típico |
|-------|---------|----------|-----------|
| **UNLIMITED** | ∞ | ∞ | Super Admin, /health |
| **RELAXED** | 1000 | 10000 | GET (leitura) |
| **NORMAL** | 100 | 5000 | POST/PUT (escrita) |
| **STRICT** | 10 | 500 | DELETE (crítico) |
| **AUTH** | 5 | 50 | Login/logout |

## 🏗️ Arquitetura

```
HTTP Request
    ↓
[RateLimitMiddleware]
    ├─ Verificar se Super Admin → Deixar passar
    ├─ Obter tenant_id ou IP → chave
    ├─ Determinar nível (GET/POST/DELETE)
    ├─ Chamar RateLimiter.check_limit()
    │   ├─ Verificar contador de minuto
    │   ├─ Verificar contador de hora
    │   └─ Incrementar ou bloquear
    └─ Retornar 429 ou deixar passar
```

## 🔧 Componentes

### 1. RateLimiter (app/core/rate_limit.py)

```python
limiter = get_rate_limiter()

# Verificar limite
allowed, reason = limiter.check_limit(
    key="tenant-123",
    level=RateLimitLevel.NORMAL
)

if not allowed:
    return 429, {"error": reason}

# Obter estatísticas
stats = limiter.get_stats("tenant-123")
# {
#   "requests_this_minute": 45,
#   "limit_per_minute": 100,
#   "percentage_used_minute": 45.0,
#   ...
# }
```

### 2. RateLimitMiddleware (app/core/middleware/rate_limit_middleware.py)

```python
app.add_middleware(RateLimitMiddleware)
```

Executa em TODA requisição autenticada e:
- Verifica se deve ser limitado
- Adiciona headers informativos
- Retorna 429 se limite atingido

### 3. Níveis de Rate Limit

```python
RateLimitLevel.UNLIMITED    # Sem limite
RateLimitLevel.RELAXED      # GET requests (1000/min)
RateLimitLevel.NORMAL       # POST/PUT (100/min)
RateLimitLevel.STRICT       # DELETE (10/min)
RateLimitLevel.AUTH         # Login (5/min)
```

## 💡 Exemplos de Uso

### 1. Verificação Manual

```python
from app.core.rate_limit import get_rate_limiter, RateLimitLevel

@app.post("/contacts")
async def create_contact(data: ContactData):
    limiter = get_rate_limiter()
    tenant_id = get_tenant_id()
    
    # Verificar limite manualmente
    allowed, reason = limiter.check_limit(
        tenant_id,
        RateLimitLevel.NORMAL
    )
    
    if not allowed:
        raise HTTPException(status_code=429, detail=reason)
    
    # Criar contato...
```

### 2. Usando Middleware (Automático)

```python
# Middleware já trata automaticamente
# Não precisa de código adicional!

@app.get("/contacts")      # GET → RELAXED (1000/min)
async def list_contacts():
    # Automaticamente limitado

@app.post("/contacts")     # POST → NORMAL (100/min)
async def create_contact():
    # Automaticamente limitado

@app.delete("/contacts/{id}")  # DELETE → STRICT (10/min)
async def delete_contact():
    # Automaticamente limitado (mais proteção)
```

### 3. Obter Estatísticas

```python
from app.core.rate_limit import get_rate_limiter

@app.get("/quota")
async def get_quota():
    """Mostrar uso de quota do usuário."""
    tenant_id = get_tenant_id()
    limiter = get_rate_limiter()
    
    stats = limiter.get_stats(tenant_id)
    
    return {
        "minute": {
            "used": stats["requests_this_minute"],
            "limit": stats["limit_per_minute"],
            "remaining": stats["limit_per_minute"] - stats["requests_this_minute"],
            "percentage": stats["percentage_used_minute"],
        },
        "hour": {
            "used": stats["requests_this_hour"],
            "limit": stats["limit_per_hour"],
            "remaining": stats["limit_per_hour"] - stats["requests_this_hour"],
            "percentage": stats["percentage_used_hour"],
        },
    }
```

## 📡 Headers de Resposta

Todas as respostas bem-sucedidas incluem:

```
X-RateLimit-Limit: 100          # Limite por minuto
X-RateLimit-Remaining: 75       # Requisições restantes
X-RateLimit-Reset: 1691254800   # Timestamp de reset (Unix)
X-RateLimit-Percentage: 25%     # Percentual usado
```

Respostas limitadas (429) incluem:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Reason: Limite por minuto atingido (100). Tente novamente em 45s.

{
  "error": "Too Many Requests",
  "detail": "Limite por minuto atingido (100). Tente novamente em 45s."
}
```

## 🛡️ Proteção por Tipo de Operação

### GET (Leitura) — RELAXED

```
1000 requisições por minuto
10000 requisições por hora

✅ Seguro para dashboards em tempo real
✅ Ideal para aplicações de leitura frequente
```

Exemplo:
```bash
# Fazer 1000 requests GET em 1 minuto = OK
# Fazer 1001º request GET = Bloqueado
```

### POST/PUT (Escrita Normal) — NORMAL

```
100 requisições por minuto
5000 requisições por hora

✅ Proteção moderada contra spam
✅ Permite operações batch (importação de contatos)
```

Exemplo:
```bash
# Criar 100 contatos em 1 minuto = OK
# Criar 101º contato = Bloqueado por 60 segundos
```

### DELETE (Crítico) — STRICT

```
10 requisições por minuto
500 requisições por hora

✅ Máxima proteção contra exclusão acidental
✅ Previne deletar base de dados inteira
```

Exemplo:
```bash
# Deletar 10 itens em 1 minuto = OK
# Deletar 11º item = Bloqueado por 60 segundos
```

### Login — AUTH

```
5 requisições por minuto
50 requisições por hora

✅ Proteção contra brute-force
✅ Bloqueio após 5 tentativas fracassadas
```

Exemplo:
```bash
# 5 tentativas de login falhas = Bloqueado por 60s
# Cliente deve aguardar antes de tentar novamente
```

## 🚨 Resposta a Limitação

### Cliente recebe:

```json
{
  "error": "Too Many Requests",
  "detail": "Limite por minuto atingido (100). Tente novamente em 45s."
}
```

### Headers:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

### Cliente deve:

1. Aguardar tempo indicado em `Retry-After`
2. Ou checar `X-RateLimit-Reset` para reset exato
3. Implementar backoff exponencial (2s, 4s, 8s...)

## 💻 Implementação no Cliente

### JavaScript/Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.deskcomm.local',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Interceptor para lidar com 429
api.interceptors.response.use(
  response => {
    const remaining = response.headers['x-ratelimit-remaining'];
    const limit = response.headers['x-ratelimit-limit'];
    
    if (remaining) {
      console.log(`Quota: ${remaining}/${limit}`);
    }
    
    return response;
  },
  async error => {
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
      console.warn(`Rate limited. Waiting ${retryAfter}s...`);
      
      // Aguardar e retry
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return api.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Python/Requests

```python
import requests
import time

session = requests.Session()
session.headers.update({'Authorization': f'Bearer {token}'})

def get_with_retry(url, max_retries=3):
    for attempt in range(max_retries):
        response = session.get(url)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', '60'))
            print(f"Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue
        
        # Log quota
        remaining = response.headers.get('X-RateLimit-Remaining')
        if remaining:
            print(f"Quota: {remaining} remaining")
        
        return response
    
    raise Exception("Max retries exceeded")
```

## 🔍 Monitoramento

### Alertas Sugeridos

```python
stats = limiter.get_stats(tenant_id)

# Alerta se > 80% do limite
if stats['percentage_used_minute'] > 80:
    alert(f"Tenant {tenant_id} usando 80% de quota!")

# Alerta se múltiplas limitações
if rate_limited_count > 5:
    alert(f"Tenant {tenant_id} foi limitado {rate_limited_count}x")
```

### Metricas Importantes

- Total de requisições por tenant
- Taxa de limitações
- Endpoints mais usados
- Padrões de abuso

## ⚙️ Configuração

### Em Desenvolvimento

```python
# Desabilitar rate limiting em dev
if DEBUG:
    app.middleware("http")(lambda request, call_next: call_next(request))
else:
    app.add_middleware(RateLimitMiddleware)
```

### Em Produção

```python
# Usar Redis em vez de memória
from redis import Redis

class RedisRateLimiter(RateLimiter):
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    def check_limit(self, key, level):
        # Implementação com Redis
        pass
```

## 🧪 Testes

```bash
# Rodar testes de rate limiting
pytest tests/core/test_rate_limiting.py -v

# 11 testes validam:
# - Todos os níveis (UNLIMITED, RELAXED, NORMAL, STRICT, AUTH)
# - Múltiplas chaves independentes
# - Cálculo de percentuais
# - Super Admin não limitado
# - Determinação de nível por método HTTP
```

## 📚 Referências

- [HTTP 429 Too Many Requests](https://tools.ietf.org/html/rfc6585#section-4)
- [Retry-After Header](https://tools.ietf.org/html/rfc7231#section-7.1.3)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

---

**Versão:** 1.0.0  
**Última atualização:** 2026-08-08
