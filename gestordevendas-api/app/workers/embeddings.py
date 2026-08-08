"""
Worker Celery: geração de embeddings para a knowledge base.

Usa OpenAI text-embedding-3-small (1536 dims).
Fallback: se não houver chave OpenAI configurada, a entrada fica
sem embedding — a busca semântica fará fallback para texto (ILIKE).
"""
from __future__ import annotations

import logging
from uuid import UUID

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name="app.workers.embeddings.generate_embedding",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="embeddings",
)
def generate_embedding(self, *, entry_id: str, account_id: str, text: str):
    """
    Gera o embedding de uma entrada da knowledge base e salva no banco.
    Requer OpenAI configurado no account. Sem chave: sem erro, apenas log.
    """
    from app.infra.supabase.ai_config_repo import AIConfigRepository
    from app.infra.supabase.knowledge_repo import KnowledgeRepository

    account_uuid = UUID(account_id)

    # 1. Verifica se OpenAI está configurado
    try:
        ai_repo = AIConfigRepository(account_uuid)
        raw_key = ai_repo.get_decrypted_key("openai")
    except Exception:
        logger.info(f"[Embed] Sem chave OpenAI para account={account_id}, pulando.")
        return

    # 2. Gera embedding
    try:
        from app.infra.ai_providers.openai_client import OpenAIClient
        client = OpenAIClient(raw_key)
        embedding = client.embed(text[:8000])  # limite seguro para o modelo
    except Exception as e:
        logger.error(f"[Embed] Falha ao gerar embedding entry={entry_id}: {e}")
        try:
            self.retry(exc=e)
        except Exception:
            logger.error(f"[Embed] Max retries para entry={entry_id}")
        return

    # 3. Salva no banco
    try:
        kb_repo = KnowledgeRepository(account_uuid)
        kb_repo.set_embedding(UUID(entry_id), embedding)
        logger.info(f"[Embed] Embedding salvo para entry={entry_id} dims={len(embedding)}")
    except Exception as e:
        logger.error(f"[Embed] Falha ao salvar embedding entry={entry_id}: {e}")


@shared_task(
    name="app.workers.embeddings.reindex_knowledge_base",
    bind=True,
    queue="embeddings",
)
def reindex_knowledge_base(self, *, account_id: str):
    """
    Regera embeddings de TODAS as entradas do account.
    Útil após trocar a chave OpenAI ou importar muitas entradas de uma vez.
    """
    from app.infra.supabase.knowledge_repo import KnowledgeRepository
    from app.infra.supabase.ai_config_repo import AIConfigRepository

    account_uuid = UUID(account_id)

    try:
        ai_repo = AIConfigRepository(account_uuid)
        raw_key = ai_repo.get_decrypted_key("openai")
    except Exception:
        logger.info(f"[Embed] Sem chave OpenAI para account={account_id}, abortando reindex.")
        return

    from app.infra.ai_providers.openai_client import OpenAIClient
    client = OpenAIClient(raw_key)
    kb_repo = KnowledgeRepository(account_uuid)

    page = 1
    total_processed = 0
    while True:
        items, total = kb_repo.list(page=page, per_page=50, is_active=True)
        if not items:
            break

        texts = [f"{r['title']}\n\n{r['content']}" for r in items]
        try:
            embeddings = client.embed_batch([t[:8000] for t in texts])
        except Exception as e:
            logger.error(f"[Embed] Batch falhou página={page}: {e}")
            break

        for row, emb in zip(items, embeddings):
            try:
                kb_repo.set_embedding(UUID(row["id"]), emb)
                total_processed += 1
            except Exception as e:
                logger.warning(f"[Embed] Falha ao salvar entry={row['id']}: {e}")

        if len(items) < 50:
            break
        page += 1

    logger.info(f"[Embed] Reindex concluído: {total_processed}/{total} entradas.")
