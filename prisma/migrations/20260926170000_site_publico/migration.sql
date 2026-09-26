-- Sprint 3 / Site imobiliario publico - fatia 1 (base de dados)

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(60),
ADD COLUMN IF NOT EXISTS "dominio" VARCHAR(255);

-- AlterTable
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "publicado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_dominio_key" ON "tenants"("dominio");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "imoveis_tenant_id_publicado_idx" ON "imoveis"("tenant_id", "publicado");
