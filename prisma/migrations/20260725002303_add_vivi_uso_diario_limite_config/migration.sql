-- CreateEnum
CREATE TYPE "AcaoLimiteVivi" AS ENUM ('ALERTAR', 'PAUSAR');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "acao_limite_vivi" "AcaoLimiteVivi" NOT NULL DEFAULT 'ALERTAR',
ADD COLUMN     "limite_mensagens_vivi_dia" INTEGER NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE "vivi_uso_diario" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "total_mensagens" INTEGER NOT NULL DEFAULT 0,
    "alerta_enviado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vivi_uso_diario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vivi_uso_diario_tenant_id_data_key" ON "vivi_uso_diario"("tenant_id", "data");

-- AddForeignKey
ALTER TABLE "vivi_uso_diario" ADD CONSTRAINT "vivi_uso_diario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
