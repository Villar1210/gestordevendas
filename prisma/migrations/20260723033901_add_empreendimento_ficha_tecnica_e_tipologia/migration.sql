-- AlterTable
ALTER TABLE "empreendimentos" ADD COLUMN     "area_terreno" DOUBLE PRECISION,
ADD COLUMN     "gabarito" INTEGER,
ADD COLUMN     "itens_lazer" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "numero_torres" INTEGER,
ADD COLUMN     "total_unidades" INTEGER,
ADD COLUMN     "unidades_por_andar" INTEGER,
ADD COLUMN     "vagas" INTEGER;

-- CreateTable
CREATE TABLE "tipologias" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "empreendimento_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "area_privativa" DOUBLE PRECISION,
    "dormitorios" INTEGER,

    CONSTRAINT "tipologias_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tipologias" ADD CONSTRAINT "tipologias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipologias" ADD CONSTRAINT "tipologias_empreendimento_id_fkey" FOREIGN KEY ("empreendimento_id") REFERENCES "empreendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
