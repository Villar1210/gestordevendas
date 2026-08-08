"""
OpenAPI Configuration - Swagger Documentation

Configuração de documentação automática com FastAPI.
"""

from fastapi.openapi.utils import get_openapi
from typing import Dict, Any


def get_openapi_schema(app) -> Dict[str, Any]:
    """
    Gera schema OpenAPI customizado para Deskcomm.
    """
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Deskcomm API",
        version="1.0.0",
        description="""
## 🚀 Enterprise Multi-Tenant Platform API

Deskcomm é uma plataforma SaaS de vendas B2B com suporte completo a múltiplos tenants,
gerenciamento de leads, contatos, conversas e integração omnichannel.

### ✨ Recursos Principais

- **Multi-Tenant Architecture** — Isolamento automático de dados por tenant
- **Role-Based Access Control** — 5 níveis de permissão (viewer → super_admin)
- **Real-Time Communication** — WebSocket para notificações em tempo real
- **Encryption at Rest** — Proteção de dados sensíveis (PII)
- **Audit Logging** — Rastreamento completo de ações com compliance
- **Rate Limiting** — Proteção contra abuso com 5 níveis de limite
- **Webhook Support** — Integração com sistemas externos

### 🔐 Autenticação

Todos os endpoints (exceto login) requerem:
```
Authorization: Bearer {jwt_token}
```

Obtenha o token fazendo login em `/auth/login`.

### 📊 Tenant Isolation

Dados são automaticamente filtrados por `tenant_id` (account_id).
- Super Admin pode acessar qualquer tenant
- Admin pode acessar apenas seu próprio tenant
- Outros roles veem apenas seus próprios dados

### 🆘 Suporte

- Docs: https://docs.ivillar.com.br
- Email: support@ivillar.com.br
- Slack: https://ivillar.slack.com
        """,
        routes=app.routes,
        tags=[
            {
                "name": "auth",
                "description": "Autenticação e gerenciamento de sessão",
            },
            {
                "name": "accounts",
                "description": "Gerenciamento de accounts/tenants",
            },
            {
                "name": "contacts",
                "description": "CRM - Gerenciamento de contatos",
            },
            {
                "name": "leads",
                "description": "CRM - Gerenciamento de leads",
            },
            {
                "name": "conversations",
                "description": "Omnichannel - Gerenciamento de conversas",
            },
            {
                "name": "super-admin",
                "description": "🔐 Super Admin Only - Acesso cross-tenant",
            },
        ],
    )

    # Customizar schemas
    openapi_schema["info"]["x-logo"] = {
        "url": "https://ivillar.com.br/logo.png"
    }

    # Servers
    openapi_schema["servers"] = [
        {
            "url": "https://api.ivillar.com.br",
            "description": "Production"
        },
        {
            "url": "https://staging-api.ivillar.com.br",
            "description": "Staging"
        },
        {
            "url": "http://localhost:8000",
            "description": "Development"
        }
    ]

    # Security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT Bearer token obtido em `/auth/login`"
        },
        "apiKey": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API Key para acesso programático"
        }
    }

    # Global security
    openapi_schema["security"] = [{"bearerAuth": []}]

    # Response schemas comuns
    openapi_schema["components"]["schemas"]["ErrorResponse"] = {
        "type": "object",
        "required": ["error", "status_code"],
        "properties": {
            "error": {"type": "string", "description": "Mensagem de erro"},
            "status_code": {"type": "integer", "description": "HTTP status code"},
            "details": {"type": "object", "description": "Detalhes adicionais"},
            "request_id": {"type": "string", "description": "ID da requisição para suporte"}
        }
    }

    openapi_schema["components"]["schemas"]["PaginatedResponse"] = {
        "type": "object",
        "properties": {
            "data": {"type": "array", "description": "Lista de items"},
            "total": {"type": "integer", "description": "Total de items"},
            "page": {"type": "integer", "description": "Página atual"},
            "limit": {"type": "integer", "description": "Items por página"},
            "pages": {"type": "integer", "description": "Total de páginas"}
        }
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


def setup_openapi(app):
    """
    Configurar OpenAPI no FastAPI app.
    Chamar no main.py:

        from app.api.openapi_config import setup_openapi
        setup_openapi(app)
    """
    app.openapi = lambda: get_openapi_schema(app)

    # Customizar swegger UI
    from fastapi.staticfiles import StaticFiles
    from fastapi.openapi.docs import (
        get_swagger_ui_html,
        get_swagger_ui_oauth2_redirect_html,
    )

    @app.get("/docs", include_in_schema=False)
    async def custom_swagger_ui_html():
        return get_swagger_ui_html(
            openapi_url=app.openapi_url,
            title=app.title + " - Swagger UI",
            oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
            swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.js",
            swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css",
            swagger_favicon_url="https://ivillar.com.br/favicon.ico",
        )

    @app.get(app.swagger_ui_oauth2_redirect_url, include_in_schema=False)
    async def swagger_ui_redirect():
        return get_swagger_ui_oauth2_redirect_html()
