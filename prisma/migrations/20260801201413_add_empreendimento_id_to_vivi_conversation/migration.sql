-- AlterTable
ALTER TABLE "vivi_conversations" ADD COLUMN     "empreendimento_id" UUID;

-- AddForeignKey
ALTER TABLE "vivi_conversations" ADD CONSTRAINT "vivi_conversations_empreendimento_id_fkey" FOREIGN KEY ("empreendimento_id") REFERENCES "empreendimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
