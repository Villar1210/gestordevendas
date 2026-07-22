-- DropIndex
DROP INDEX "imoveis_identificador_externo_key";

-- CreateIndex
CREATE UNIQUE INDEX "imoveis_tenant_id_identificador_externo_key" ON "imoveis"("tenant_id", "identificador_externo");

