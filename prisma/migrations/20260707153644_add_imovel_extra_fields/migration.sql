-- AlterTable
ALTER TABLE "imoveis" ADD COLUMN     "codigo_interno" VARCHAR(50),
ADD COLUMN     "disponivel_a_partir_de" TIMESTAMP(3),
ADD COLUMN     "exclusividade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "local_chaves" VARCHAR(20),
ADD COLUMN     "proprietario_nome" VARCHAR(150),
ADD COLUMN     "proprietario_telefone" VARCHAR(30),
ADD COLUMN     "tags" TEXT,
ADD COLUMN     "uso" VARCHAR(20);
