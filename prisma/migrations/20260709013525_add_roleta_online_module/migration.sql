-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "suggested_owner_id" UUID;

-- CreateTable
CREATE TABLE "roleta_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "algoritmo" VARCHAR(20) NOT NULL DEFAULT 'round_robin',
    "modo" VARCHAR(20) NOT NULL DEFAULT 'semi_automatico',
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_corretor_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roleta_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roleta_configs_tenant_id_key" ON "roleta_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_suggested_owner_id_fkey" FOREIGN KEY ("suggested_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_configs" ADD CONSTRAINT "roleta_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
