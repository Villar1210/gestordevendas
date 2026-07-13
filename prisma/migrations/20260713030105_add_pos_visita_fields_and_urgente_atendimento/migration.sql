-- AlterTable
ALTER TABLE "atendimentos" ADD COLUMN     "urgente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vivi_conversations" ADD COLUMN     "data_nascimento" VARCHAR(20),
ADD COLUMN     "email" VARCHAR(150),
ADD COLUMN     "fez_declaracao_ir" BOOLEAN,
ADD COLUMN     "tipo_renda" VARCHAR(20);
