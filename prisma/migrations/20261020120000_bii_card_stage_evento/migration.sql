-- Modulo BII - Fatia 1: historico de etapas dos cards (BiiCardStageEvento).
-- Aditiva: so uma tabela NOVA + indices + FKs. Nenhuma tabela/dado existente
-- e alterado. Historico comeca vazio (so registra a partir da implantacao).

-- CreateTable
CREATE TABLE "bii_card_stage_eventos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "pipeline_id" UUID,
    "from_stage_id" UUID,
    "to_stage_id" UUID NOT NULL,
    "from_stage_nome" VARCHAR(100),
    "to_stage_nome" VARCHAR(100) NOT NULL,
    "user_id" UUID,
    "origem" VARCHAR(20) NOT NULL,
    "motivo_repique" VARCHAR(30),
    "ocorrido_em" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bii_card_stage_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bii_card_stage_eventos_tenant_id_ocorrido_em_idx" ON "bii_card_stage_eventos"("tenant_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "bii_card_stage_eventos_tenant_id_card_id_ocorrido_em_idx" ON "bii_card_stage_eventos"("tenant_id", "card_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "bii_card_stage_eventos_tenant_id_to_stage_nome_ocorrido_em_idx" ON "bii_card_stage_eventos"("tenant_id", "to_stage_nome", "ocorrido_em");

-- AddForeignKey
ALTER TABLE "bii_card_stage_eventos" ADD CONSTRAINT "bii_card_stage_eventos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bii_card_stage_eventos" ADD CONSTRAINT "bii_card_stage_eventos_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
