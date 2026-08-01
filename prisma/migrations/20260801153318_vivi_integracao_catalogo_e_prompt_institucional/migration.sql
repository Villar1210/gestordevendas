-- AlterEnum
BEGIN;
CREATE TYPE "ImovelEnquadramento_new" AS ENUM ('NENHUM', 'FAIXA_1', 'FAIXA_2', 'FAIXA_3', 'FAIXA_4', 'R2V');
ALTER TABLE "imoveis" ALTER COLUMN "enquadramento" DROP DEFAULT;
ALTER TABLE "imoveis" ALTER COLUMN "enquadramento" TYPE "ImovelEnquadramento_new" USING ("enquadramento"::text::"ImovelEnquadramento_new");
ALTER TYPE "ImovelEnquadramento" RENAME TO "ImovelEnquadramento_old";
ALTER TYPE "ImovelEnquadramento_new" RENAME TO "ImovelEnquadramento";
DROP TYPE "ImovelEnquadramento_old";
ALTER TABLE "imoveis" ALTER COLUMN "enquadramento" SET DEFAULT 'NENHUM';
COMMIT;

-- AlterTable
ALTER TABLE "empreendimentos" ADD COLUMN     "diferenciais" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "plantao_corretor_responsavel" VARCHAR(150),
ADD COLUMN     "plantao_endereco" VARCHAR(200),
ADD COLUMN     "plantao_horario_funcionamento" VARCHAR(150),
ADD COLUMN     "plantao_whatsapp_corretor" VARCHAR(30),
ADD COLUMN     "prova_social" TEXT,
ADD COLUMN     "proximo_metro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status_obra" VARCHAR(20);

-- AlterTable
ALTER TABLE "vivi_configs" ADD COLUMN     "diferenciais_construtora" VARCHAR(1500),
ADD COLUMN     "mencionar_selo_his" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sobre_construtora" VARCHAR(2000);
