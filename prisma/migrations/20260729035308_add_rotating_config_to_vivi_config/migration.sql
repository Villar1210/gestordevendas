-- AlterTable
ALTER TABLE "vivi_configs" ADD COLUMN     "ativa_rotating_indicador" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dias_para_rotting" INTEGER NOT NULL DEFAULT 30;
