-- BII Fatia 6: camadas publicas do GeoSampa (so CREATE TABLE).
CREATE TABLE "geo_quadras_fiscais" (
    "setor" CHAR(3) NOT NULL,
    "quadra" CHAR(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "geo_quadras_fiscais_pkey" PRIMARY KEY ("setor","quadra")
);

CREATE TABLE "geo_lotes_fiscais" (
    "setor" CHAR(3) NOT NULL,
    "quadra" CHAR(3) NOT NULL,
    "lote" CHAR(4) NOT NULL,
    "condominio" CHAR(2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "geo_lotes_fiscais_pkey" PRIMARY KEY ("setor","quadra","lote","condominio")
);

-- CreateIndex (Fatia 6: localizar as guias por setor do SQL sem varrer a tabela)
CREATE INDEX "itbi_transacoes_sql_cadastro_idx" ON "itbi_transacoes"("sql_cadastro");
