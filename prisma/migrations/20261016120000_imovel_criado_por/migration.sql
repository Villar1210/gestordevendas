-- Permissoes da area Imoveis (R2): quem cadastrou o imovel pelo POST /imoveis.
-- Aditiva: so uma coluna NULLABLE nova + indice + FK. Imoveis existentes ficam
-- NULL (tratados como do Administrador). Nenhum dado existente e alterado.

-- AlterTable
ALTER TABLE "imoveis" ADD COLUMN "criado_por_user_id" UUID;

-- CreateIndex
CREATE INDEX "imoveis_criado_por_user_id_idx" ON "imoveis"("criado_por_user_id");

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
