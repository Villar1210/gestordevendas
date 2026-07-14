-- AlterTable
ALTER TABLE "users" ADD COLUMN "contrato_prestacao_servico_envelope_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "users_contrato_prestacao_servico_envelope_id_key" ON "users"("contrato_prestacao_servico_envelope_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_contrato_prestacao_servico_envelope_id_fkey" FOREIGN KEY ("contrato_prestacao_servico_envelope_id") REFERENCES "signature_envelopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
