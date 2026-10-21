-- BII Fatia 3 - concorrentes cadastrados manualmente (por tenant, FK tenants
-- ON DELETE CASCADE) e suas tipologias (FK concorrente ON DELETE CASCADE).
-- So CREATE TABLE / INDEX - nenhuma tabela existente e alterada.

-- CreateTable
CREATE TABLE "bii_concorrentes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "construtora" VARCHAR(150),
    "endereco" VARCHAR(200) NOT NULL,
    "endereco_formatado" VARCHAR(500),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precisao" VARCHAR(10) NOT NULL,
    "fase" VARCHAR(20) NOT NULL,
    "data_lancamento" DATE,
    "total_unidades" INTEGER,
    "unidades_vendidas" INTEGER,
    "fonte" VARCHAR(120),
    "fonte_url" VARCHAR(500),
    "observacoes" VARCHAR(1000),
    "origem" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bii_concorrentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bii_concorrente_tipologias" (
    "id" UUID NOT NULL,
    "concorrente_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" VARCHAR(100) NOT NULL,
    "dormitorios" INTEGER,
    "area_privativa" DECIMAL(8,2) NOT NULL,
    "preco_de" DECIMAL(12,2) NOT NULL,
    "preco_ate" DECIMAL(12,2),

    CONSTRAINT "bii_concorrente_tipologias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bii_concorrentes_tenant_id_latitude_longitude_idx" ON "bii_concorrentes"("tenant_id", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "bii_concorrentes_tenant_id_updated_at_idx" ON "bii_concorrentes"("tenant_id", "updated_at");

-- CreateIndex
CREATE INDEX "bii_concorrente_tipologias_concorrente_id_idx" ON "bii_concorrente_tipologias"("concorrente_id");

-- AddForeignKey
ALTER TABLE "bii_concorrentes" ADD CONSTRAINT "bii_concorrentes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bii_concorrente_tipologias" ADD CONSTRAINT "bii_concorrente_tipologias_concorrente_id_fkey" FOREIGN KEY ("concorrente_id") REFERENCES "bii_concorrentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
