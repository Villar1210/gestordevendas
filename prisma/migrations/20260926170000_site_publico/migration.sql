-- Sprint 3 / Site imobiliario publico - fatia 1 (base de dados)

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "slug" VARCHAR(60),
ADD COLUMN "dominio" VARCHAR(255);

-- AlterTable
ALTER TABLE "imoveis" ADD COLUMN "publicado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_dominio_key" ON "tenants"("dominio");

-- CreateIndex
CREATE INDEX "imoveis_tenant_id_publicado_idx" ON "imoveis"("tenant_id", "publicado");
