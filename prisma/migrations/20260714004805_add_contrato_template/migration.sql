-- CreateTable
CREATE TABLE "contrato_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "corpo" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contrato_templates" ADD CONSTRAINT "contrato_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
