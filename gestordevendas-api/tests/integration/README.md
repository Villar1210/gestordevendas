# Testes de Integração

Estes testes rodam contra a API real (backend ligado + banco de dados real).

## Pré-requisitos

```bash
# 1. Backend rodando em localhost:8000
cd gestordevendas-api && uvicorn app.main:app --port 8000

# 2. Variáveis de ambiente para teste
cp .env .env.test
# Configure TEST_ACCOUNT_ID, TEST_USER_EMAIL, TEST_USER_PASSWORD no .env.test

# 3. Rodar os testes
pytest tests/integration/ -v
```

## Variáveis necessárias no .env.test

```
TEST_BASE_URL=http://localhost:8000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test_password_123
TEST_ACCOUNT_ID=uuid-da-conta-de-teste
```
