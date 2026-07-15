-- CreateTable
CREATE TABLE "vivi_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "preco_minimo" DECIMAL(12,2) NOT NULL DEFAULT 264000,
    "limite_sem_perfil" DECIMAL(12,2) NOT NULL DEFAULT 1500,
    "limite_his1" DECIMAL(12,2) NOT NULL DEFAULT 2850,
    "limite_his2" DECIMAL(12,2) NOT NULL DEFAULT 4700,
    "limite_hmp" DECIMAL(12,2) NOT NULL DEFAULT 8000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vivi_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vivi_configs_tenant_id_key" ON "vivi_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "vivi_configs" ADD CONSTRAINT "vivi_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
