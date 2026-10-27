-- Fase B (27/10/2026): coluna "Atendimento VIVI" no Kanban.
-- So ADD COLUMN com default (nao reescreve dados existentes) + 1 indice.
ALTER TABLE "cards" ADD COLUMN "em_atendimento_vivi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cards" ADD COLUMN "ultima_interacao_vivi_em" TIMESTAMP(3);
ALTER TABLE "cards" ADD COLUMN "caixa_entrada_desde" TIMESTAMP(3);
CREATE INDEX "cards_tenant_id_em_atendimento_vivi_idx" ON "cards"("tenant_id", "em_atendimento_vivi");
