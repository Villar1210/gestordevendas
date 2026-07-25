/*
  Warnings:

  - You are about to drop the column `alerta_enviado` on the `vivi_uso_diario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "vivi_uso_diario" DROP COLUMN "alerta_enviado",
ADD COLUMN     "alerta_atencao_enviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alerta_concentracao_enviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alerta_critico_enviado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "vivi_uso_diario_numero" (
    "id" UUID NOT NULL,
    "vivi_uso_diario_id" UUID NOT NULL,
    "numero" VARCHAR(100) NOT NULL,

    CONSTRAINT "vivi_uso_diario_numero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vivi_uso_diario_numero_vivi_uso_diario_id_numero_key" ON "vivi_uso_diario_numero"("vivi_uso_diario_id", "numero");

-- AddForeignKey
ALTER TABLE "vivi_uso_diario_numero" ADD CONSTRAINT "vivi_uso_diario_numero_vivi_uso_diario_id_fkey" FOREIGN KEY ("vivi_uso_diario_id") REFERENCES "vivi_uso_diario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
