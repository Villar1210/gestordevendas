-- WhatsApp integrado - Etapa 1, parte 2 (19/11/2026): copia das mensagens do
-- numero oficial vindas do Chatwoot (ChatwootMensagem).
-- Aditiva: so uma tabela NOVA + indices + FKs. Nenhuma tabela/dado existente
-- e alterado.

-- CreateTable
CREATE TABLE "chatwoot_mensagens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "card_id" UUID,
    "telefone" VARCHAR(30) NOT NULL,
    "telefone_chave" VARCHAR(30) NOT NULL,
    "chatwoot_message_id" INTEGER NOT NULL,
    "chatwoot_conversation_id" INTEGER NOT NULL,
    "chatwoot_inbox_id" INTEGER NOT NULL,
    "direcao" VARCHAR(10) NOT NULL,
    "autor_tipo" VARCHAR(12) NOT NULL,
    "autor_nome" VARCHAR(150),
    "autor_user_id" UUID,
    "conteudo" TEXT,
    "anexos" JSONB,
    "enviada_em" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatwoot_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chatwoot_mensagens_chatwoot_message_id_key" ON "chatwoot_mensagens"("chatwoot_message_id");

-- CreateIndex
CREATE INDEX "chatwoot_mensagens_card_id_enviada_em_idx" ON "chatwoot_mensagens"("card_id", "enviada_em");

-- CreateIndex
CREATE INDEX "chatwoot_mensagens_tenant_id_telefone_chave_idx" ON "chatwoot_mensagens"("tenant_id", "telefone_chave");

-- AddForeignKey
ALTER TABLE "chatwoot_mensagens" ADD CONSTRAINT "chatwoot_mensagens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatwoot_mensagens" ADD CONSTRAINT "chatwoot_mensagens_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatwoot_mensagens" ADD CONSTRAINT "chatwoot_mensagens_autor_user_id_fkey" FOREIGN KEY ("autor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
