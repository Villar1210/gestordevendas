-- CreateTable
CREATE TABLE "lancamentos_financeiros" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contrato_id" UUID,
    "tipo" VARCHAR(10) NOT NULL,
    "categoria" VARCHAR(30) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "pago_em" TIMESTAMP(3),
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
