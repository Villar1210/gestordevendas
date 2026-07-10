-- AlterTable
ALTER TABLE "inquilinos_compradores" ADD COLUMN     "observacoes_analise" TEXT,
ADD COLUMN     "profissao" VARCHAR(100),
ADD COLUMN     "renda_declarada" DECIMAL(12,2),
ADD COLUMN     "status_analise_credito" VARCHAR(20) NOT NULL DEFAULT 'nao_iniciada';

-- CreateTable
CREATE TABLE "inquilino_documentos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "inquilino_id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquilino_documentos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "inquilino_documentos" ADD CONSTRAINT "inquilino_documentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilino_documentos" ADD CONSTRAINT "inquilino_documentos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos_compradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
