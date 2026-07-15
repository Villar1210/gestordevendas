-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stand_id" UUID;

-- CreateTable
CREATE TABLE "stands" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "endereco" VARCHAR(200),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalas_plantao" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "stand_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,

    CONSTRAINT "escalas_plantao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escalas_plantao_stand_id_user_id_dia_semana_key" ON "escalas_plantao"("stand_id", "user_id", "dia_semana");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stands" ADD CONSTRAINT "stands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_plantao" ADD CONSTRAINT "escalas_plantao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_plantao" ADD CONSTRAINT "escalas_plantao_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_plantao" ADD CONSTRAINT "escalas_plantao_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
