-- Modulo Campanhas SMS (docs/campanhas/CONTRATO_CAMPANHA_SMS.md).
-- So CREATE TABLE / INDEX - nenhuma tabela existente e alterada.
-- Tudo POR TENANT (FK tenants ON DELETE CASCADE).

-- CreateTable
CREATE TABLE "campanhas_sms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "mensagem" VARCHAR(600) NOT NULL,
    "link_destino" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    "max_segmentos" INTEGER NOT NULL DEFAULT 1,
    "taxa_por_minuto" INTEGER NOT NULL DEFAULT 30,
    "janela_inicio" INTEGER NOT NULL DEFAULT 9,
    "janela_fim" INTEGER NOT NULL DEFAULT 20,
    "codigo_teste" VARCHAR(12) NOT NULL,
    "criado_por_user_id" UUID NOT NULL,
    "iniciada_em" TIMESTAMP(3),
    "concluida_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_sms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas_sms_contatos" (
    "id" UUID NOT NULL,
    "campanha_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "primeiro_nome" VARCHAR(40) NOT NULL,
    "telefone" VARCHAR(15) NOT NULL,
    "corretor" VARCHAR(120),
    "referencia" VARCHAR(60),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "codigo" VARCHAR(12) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "provedor_mensagem_id" VARCHAR(100),
    "erro" VARCHAR(300),
    "enviado_em" TIMESTAMP(3),
    "entregue_em" TIMESTAMP(3),
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "primeiro_clique_em" TIMESTAMP(3),
    "ultimo_clique_em" TIMESTAMP(3),
    "resposta_texto" VARCHAR(500),
    "respondido_em" TIMESTAMP(3),
    "optout_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_sms_contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_optouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "telefone" VARCHAR(15) NOT NULL,
    "origem" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_optouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campanhas_sms_codigo_teste_key" ON "campanhas_sms"("codigo_teste");

-- CreateIndex
CREATE INDEX "campanhas_sms_tenant_id_created_at_idx" ON "campanhas_sms"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "campanhas_sms_status_idx" ON "campanhas_sms"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campanhas_sms_contatos_codigo_key" ON "campanhas_sms_contatos"("codigo");

-- CreateIndex
CREATE INDEX "campanhas_sms_contatos_campanha_id_status_idx" ON "campanhas_sms_contatos"("campanha_id", "status");

-- CreateIndex
CREATE INDEX "campanhas_sms_contatos_provedor_mensagem_id_idx" ON "campanhas_sms_contatos"("provedor_mensagem_id");

-- CreateIndex
CREATE INDEX "campanhas_sms_contatos_telefone_enviado_em_idx" ON "campanhas_sms_contatos"("telefone", "enviado_em");

-- CreateIndex
CREATE UNIQUE INDEX "campanhas_sms_contatos_campanha_id_telefone_key" ON "campanhas_sms_contatos"("campanha_id", "telefone");

-- CreateIndex
CREATE UNIQUE INDEX "sms_optouts_tenant_id_telefone_key" ON "sms_optouts"("tenant_id", "telefone");

-- AddForeignKey
ALTER TABLE "campanhas_sms" ADD CONSTRAINT "campanhas_sms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas_sms_contatos" ADD CONSTRAINT "campanhas_sms_contatos_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "campanhas_sms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas_sms_contatos" ADD CONSTRAINT "campanhas_sms_contatos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_optouts" ADD CONSTRAINT "sms_optouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
