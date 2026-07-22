-- CreateEnum
CREATE TYPE "ImovelTipoItem" AS ENUM ('UNIDADE', 'VAGA_AVULSA');

-- CreateEnum
CREATE TYPE "ImovelEnquadramento" AS ENUM ('HIS2', 'HMP', 'R2V', 'NENHUM');

-- CreateEnum
CREATE TYPE "ImovelStatus" AS ENUM ('DISPONIVEL', 'RESERVADO', 'EM_NEGOCIACAO', 'VENDIDO', 'BLOQUEADO', 'EM_ANALISE', 'DISTRATO', 'OCUPADO', 'VAGO', 'INATIVO');

-- AlterTable
ALTER TABLE "empreendimentos" ADD COLUMN     "origem_importacao" VARCHAR(200),
ADD COLUMN     "publicado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "imoveis" ADD COLUMN     "andar" INTEGER,
ADD COLUMN     "bloco" VARCHAR(50),
ADD COLUMN     "enquadramento" "ImovelEnquadramento" NOT NULL DEFAULT 'NENHUM',
ADD COLUMN     "identificador_externo" VARCHAR(100),
ADD COLUMN     "numero_no_andar" INTEGER,
ADD COLUMN     "pcd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo_item" "ImovelTipoItem" NOT NULL DEFAULT 'UNIDADE',
ADD COLUMN     "vagas_incluidas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valor_com_desconto" DECIMAL(12,2),
ADD COLUMN     "valor_tabela" DECIMAL(12,2),
DROP COLUMN "status",
ADD COLUMN     "status" "ImovelStatus" NOT NULL DEFAULT 'DISPONIVEL';

-- CreateIndex
CREATE UNIQUE INDEX "imoveis_identificador_externo_key" ON "imoveis"("identificador_externo");

