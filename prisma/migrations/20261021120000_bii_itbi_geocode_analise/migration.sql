-- Modulo BII - Fatia 2: Analise por Endereco + ITBI.
-- Aditiva: so tabelas NOVAS + indices + FKs. Nenhuma tabela/dado existente e
-- alterado. itbi_transacoes, geocode_cache e itbi_importacoes sao GLOBAIS
-- (dado publico, sem tenant_id e sem FK para tabela de tenant); bii_analises e
-- por tenant (FK tenants ON DELETE CASCADE).

-- CreateTable
CREATE TABLE "itbi_importacoes" (
    "id" UUID NOT NULL,
    "nome_arquivo" VARCHAR(120) NOT NULL,
    "ano" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "linhas_lidas" INTEGER NOT NULL DEFAULT 0,
    "linhas_inseridas" INTEGER NOT NULL DEFAULT 0,
    "linhas_duplicadas" INTEGER NOT NULL DEFAULT 0,
    "linhas_descartadas" INTEGER NOT NULL DEFAULT 0,
    "abas" JSONB,
    "mensagem_erro" VARCHAR(300),
    "importado_por_user_id" UUID NOT NULL,
    "iniciado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "concluido_em" TIMESTAMP(3),

    CONSTRAINT "itbi_importacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itbi_transacoes" (
    "id" UUID NOT NULL,
    "hash_linha" CHAR(64) NOT NULL,
    "sql_cadastro" VARCHAR(30),
    "logradouro" VARCHAR(200) NOT NULL,
    "numero" VARCHAR(20),
    "complemento" VARCHAR(100),
    "referencia" VARCHAR(150),
    "bairro" VARCHAR(100),
    "bairro_normalizado" VARCHAR(100),
    "cep" VARCHAR(8),
    "cep_prefixo" CHAR(5),
    "endereco_chave" VARCHAR(260) NOT NULL,
    "natureza_codigo" INTEGER,
    "natureza_transacao" VARCHAR(120),
    "valor_transacao" DECIMAL(14,2) NOT NULL,
    "data_transacao" DATE NOT NULL,
    "valor_venal_referencia" DECIMAL(14,2),
    "proporcao_transmitida" DECIMAL(7,4),
    "tipo_financiamento_codigo" INTEGER,
    "tipo_financiamento" VARCHAR(120),
    "valor_financiado" DECIMAL(14,2),
    "situacao_sql" VARCHAR(40),
    "area_terreno" DECIMAL(12,2),
    "fracao_ideal" DECIMAL(11,10),
    "area_construida" DECIMAL(12,2),
    "uso_iptu" INTEGER,
    "uso_descricao" VARCHAR(150),
    "padrao_iptu" INTEGER,
    "padrao_descricao" VARCHAR(150),
    "acc_iptu" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geo_precisao" VARCHAR(10),
    "importacao_id" UUID,
    "arquivo_aba" VARCHAR(100),
    "importado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itbi_transacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocode_cache" (
    "id" UUID NOT NULL,
    "chave" VARCHAR(300) NOT NULL,
    "provedor" VARCHAR(20) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precisao" VARCHAR(10),
    "cep" VARCHAR(8),
    "endereco_formatado" VARCHAR(500),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bii_analises" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "impersonado_por" UUID,
    "endereco_digitado" VARCHAR(200) NOT NULL,
    "endereco_formatado" VARCHAR(500) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precisao" VARCHAR(10) NOT NULL,
    "raio_metros" INTEGER NOT NULL,
    "meses" INTEGER NOT NULL,
    "area_min" DECIMAL(12,2),
    "area_max" DECIMAL(12,2),
    "transacoes" INTEGER NOT NULL DEFAULT 0,
    "preco_m2_mediano" DECIMAL(12,2),
    "resultado" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bii_analises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itbi_importacoes_status_idx" ON "itbi_importacoes"("status");

-- CreateIndex
CREATE INDEX "itbi_importacoes_iniciado_em_idx" ON "itbi_importacoes"("iniciado_em");

-- CreateIndex
CREATE UNIQUE INDEX "itbi_transacoes_hash_linha_key" ON "itbi_transacoes"("hash_linha");

-- CreateIndex
CREATE INDEX "itbi_transacoes_latitude_longitude_idx" ON "itbi_transacoes"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "itbi_transacoes_data_transacao_idx" ON "itbi_transacoes"("data_transacao");

-- CreateIndex
CREATE INDEX "itbi_transacoes_endereco_chave_idx" ON "itbi_transacoes"("endereco_chave");

-- CreateIndex
CREATE INDEX "itbi_transacoes_cep_prefixo_data_transacao_idx" ON "itbi_transacoes"("cep_prefixo", "data_transacao");

-- CreateIndex
CREATE INDEX "itbi_transacoes_bairro_normalizado_idx" ON "itbi_transacoes"("bairro_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "geocode_cache_chave_key" ON "geocode_cache"("chave");

-- CreateIndex
CREATE INDEX "bii_analises_tenant_id_created_at_idx" ON "bii_analises"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "itbi_transacoes" ADD CONSTRAINT "itbi_transacoes_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "itbi_importacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bii_analises" ADD CONSTRAINT "bii_analises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
