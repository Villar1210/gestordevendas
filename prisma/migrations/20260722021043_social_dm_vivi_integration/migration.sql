-- AlterTable
ALTER TABLE "vivi_configs" ALTER COLUMN "limite_faixa1" SET DEFAULT 3200,
ALTER COLUMN "limite_faixa2" SET DEFAULT 5000,
ALTER COLUMN "limite_faixa3" SET DEFAULT 9600;

-- CreateTable
CREATE TABLE "social_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "social_account_id" UUID NOT NULL,
    "direction" VARCHAR(3) NOT NULL,
    "identificador_externo" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "social_account_id" UUID NOT NULL,
    "identificador_externo" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'em_andamento',
    "nome_coletado" VARCHAR(150),
    "tipo_imovel_coletado" VARCHAR(50),
    "orcamento_coletado" VARCHAR(100),
    "regiao_coletado" VARCHAR(150),
    "finalidade_coletado" VARCHAR(20),
    "card_id" UUID,
    "visita_agendada_em" TIMESTAMP(3),
    "renda_declarada" DOUBLE PRECISION,
    "categoria_habitacional" VARCHAR(20),
    "data_nascimento" VARCHAR(20),
    "email" VARCHAR(150),
    "tipo_renda" VARCHAR(20),
    "fez_declaracao_ir" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_messages_social_account_id_identificador_externo_idx" ON "social_messages"("social_account_id", "identificador_externo");

-- CreateIndex
CREATE INDEX "social_conversations_social_account_id_identificador_extern_idx" ON "social_conversations"("social_account_id", "identificador_externo");

-- AddForeignKey
ALTER TABLE "social_messages" ADD CONSTRAINT "social_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_messages" ADD CONSTRAINT "social_messages_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_conversations" ADD CONSTRAINT "social_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_conversations" ADD CONSTRAINT "social_conversations_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_conversations" ADD CONSTRAINT "social_conversations_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
