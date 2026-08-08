# ── Gestor de Vendas CRM — API ────────────────────────────────────────────────
# Multi-stage build: builder instala deps, runner é a imagem final (~200MB).

FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Runner ────────────────────────────────────────────────────────────────────

FROM python:3.12-slim AS runner

LABEL maintainer="Gestor de Vendas <dev@gestordevendas.com.br>"
LABEL description="Gestor de Vendas CRM — FastAPI Backend"

# Usuário não-root por segurança
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copia dependências instaladas do builder
COPY --from=builder /install /usr/local

# Copia código da aplicação
COPY app/ ./app/

RUN chown -R appuser:appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    APP_ENV=production \
    PORT=8000

EXPOSE 8000

# Health check leve (sem curl, usa stdlib)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# API: uvicorn com 2 workers (ajustar para 2*CPU+1 em produção)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--log-level", "info"]
