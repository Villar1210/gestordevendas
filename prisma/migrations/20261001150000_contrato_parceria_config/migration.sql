-- Sprint 10 / Assinaturas do contrato de parceria configuraveis por empresa

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aguardando_assinatura_contrato" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "contrato_parceria_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assinatura_empresa_ativa" BOOLEAN NOT NULL DEFAULT false,
    "representante_nome" VARCHAR(150),
    "representante_email" VARCHAR(150),
    "representante_cargo" VARCHAR(100),
    "quantidade_testemunhas" INTEGER NOT NULL DEFAULT 0,
    "testemunha1_nome" VARCHAR(150),
    "testemunha1_email" VARCHAR(150),
    "testemunha2_nome" VARCHAR(150),
    "testemunha2_email" VARCHAR(150),
    "bloquear_acesso_ate_assinar" BOOLEAN NOT NULL DEFAULT false,
    "lembretes_ativos" BOOLEAN NOT NULL DEFAULT false,
    "lembrete_dias" VARCHAR(30) NOT NULL DEFAULT '2,5',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_parceria_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contrato_parceria_configs_tenant_id_key" ON "contrato_parceria_configs"("tenant_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "contrato_parceria_configs" ADD CONSTRAINT "contrato_parceria_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
