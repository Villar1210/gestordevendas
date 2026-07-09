-- AlterTable
ALTER TABLE "whatsapp_sessions" ADD COLUMN     "is_ai_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "vivi_conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "whatsapp_session_id" UUID NOT NULL,
    "phone_number" VARCHAR(30) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'em_andamento',
    "nome_coletado" VARCHAR(150),
    "tipo_imovel_coletado" VARCHAR(50),
    "orcamento_coletado" VARCHAR(100),
    "regiao_coletado" VARCHAR(150),
    "finalidade_coletado" VARCHAR(20),
    "card_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vivi_conversations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vivi_conversations" ADD CONSTRAINT "vivi_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vivi_conversations" ADD CONSTRAINT "vivi_conversations_whatsapp_session_id_fkey" FOREIGN KEY ("whatsapp_session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vivi_conversations" ADD CONSTRAINT "vivi_conversations_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
