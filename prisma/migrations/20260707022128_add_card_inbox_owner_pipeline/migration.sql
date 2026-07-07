/*
  Warnings:

  - Added the required column `pipeline_id` to the `cards` table.
    Como a coluna precisa ser NOT NULL e a tabela pode ja ter linhas,
    ela e criada opcional, populada a partir do stage atual de cada
    card, e so entao marcada como obrigatoria.

*/
-- AlterTable: adiciona owner_id e pipeline_id (ainda opcional) e libera stage_id
ALTER TABLE "cards" ADD COLUMN     "owner_id" UUID,
ADD COLUMN     "pipeline_id" UUID,
ALTER COLUMN "stage_id" DROP NOT NULL;

-- Backfill: copia o pipeline_id a partir do Stage atual de cada card
UPDATE "cards"
SET "pipeline_id" = "stages"."pipeline_id"
FROM "stages"
WHERE "cards"."stage_id" = "stages"."id";

-- Agora que todo card existente tem pipeline_id preenchido, torna a coluna obrigatoria
ALTER TABLE "cards" ALTER COLUMN "pipeline_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
