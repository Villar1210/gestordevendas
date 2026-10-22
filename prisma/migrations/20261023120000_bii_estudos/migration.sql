-- BII Fatia 5 - estudos de terreno (por tenant, FK tenants ON DELETE CASCADE;
-- FK bii_analises ON DELETE SET NULL - o estudo guarda a propria copia).
-- So CREATE TABLE / INDEX - nenhuma tabela existente e alterada.

-- CreateTable
CREATE TABLE "bii_estudos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "analise_id" UUID,
    "nome" VARCHAR(120) NOT NULL,
    "endereco_formatado" VARCHAR(500) NOT NULL,
    "raio_metros" INTEGER NOT NULL,
    "meses" INTEGER NOT NULL,
    "tipologias" JSONB NOT NULL,
    "premissas" JSONB NOT NULL,
    "conclusao" VARCHAR(5000),
    "situacao_resumo" JSONB NOT NULL,
    "resultado" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bii_estudos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bii_estudos_tenant_id_created_at_idx" ON "bii_estudos"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "bii_estudos" ADD CONSTRAINT "bii_estudos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bii_estudos" ADD CONSTRAINT "bii_estudos_analise_id_fkey" FOREIGN KEY ("analise_id") REFERENCES "bii_analises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
