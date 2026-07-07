-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "imovel_id" UUID;

-- CreateTable
CREATE TABLE "empreendimentos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "rua" VARCHAR(200) NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "bairro" VARCHAR(100) NOT NULL,
    "cidade" VARCHAR(100) NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "cep" VARCHAR(10) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empreendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imoveis" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "empreendimento_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "finalidade" VARCHAR(10) NOT NULL,
    "price" DECIMAL(12,2),
    "rent_price" DECIMAL(12,2),
    "area" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "parking_spots" INTEGER,
    "rua" VARCHAR(200),
    "numero" VARCHAR(20),
    "complemento" VARCHAR(100),
    "bairro" VARCHAR(100),
    "cidade" VARCHAR(100),
    "uf" VARCHAR(2),
    "cep" VARCHAR(10),
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'disponivel',
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imoveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imovel_photos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "imovel_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imovel_photos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_imovel_id_fkey" FOREIGN KEY ("imovel_id") REFERENCES "imoveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimentos" ADD CONSTRAINT "empreendimentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_empreendimento_id_fkey" FOREIGN KEY ("empreendimento_id") REFERENCES "empreendimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imovel_photos" ADD CONSTRAINT "imovel_photos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imovel_photos" ADD CONSTRAINT "imovel_photos_imovel_id_fkey" FOREIGN KEY ("imovel_id") REFERENCES "imoveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
