-- Fatia 2 (Atendimento/Roleta): Sorteio da vez - roletas por Stand/Produto

-- AlterTable
ALTER TABLE "cards" ADD COLUMN "empreendimento_id" UUID;

-- CreateTable
CREATE TABLE "roletas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "stand_id" UUID,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "modo_sorteio" VARCHAR(12) NOT NULL DEFAULT 'automatico',
    "horarios_sorteio" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minutos_sorteio_seguranca" INTEGER NOT NULL DEFAULT 15,
    "fila_dia" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roletas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roleta_empreendimentos" (
    "roleta_id" UUID NOT NULL,
    "empreendimento_id" UUID NOT NULL,

    CONSTRAINT "roleta_empreendimentos_pkey" PRIMARY KEY ("roleta_id","empreendimento_id")
);

-- CreateTable
CREATE TABLE "roleta_corretores" (
    "roleta_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "roleta_corretores_pkey" PRIMARY KEY ("roleta_id","user_id")
);

-- CreateTable
CREATE TABLE "roleta_posicoes" (
    "roleta_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "posicao" INTEGER NOT NULL,
    "entrou_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_lead_em" TIMESTAMP(3),

    CONSTRAINT "roleta_posicoes_pkey" PRIMARY KEY ("roleta_id","user_id")
);

-- CreateTable
CREATE TABLE "roleta_sorteios" (
    "id" UUID NOT NULL,
    "roleta_id" UUID NOT NULL,
    "origem" VARCHAR(12) NOT NULL,
    "disparado_por_id" UUID,
    "horario" VARCHAR(5),
    "ordem" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roleta_sorteios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roleta_horario_execucoes" (
    "roleta_id" UUID NOT NULL,
    "dia" VARCHAR(10) NOT NULL,
    "horario" VARCHAR(5) NOT NULL,
    "avisado_em" TIMESTAMP(3),
    "sorteado_em" TIMESTAMP(3),

    CONSTRAINT "roleta_horario_execucoes_pkey" PRIMARY KEY ("roleta_id","dia","horario")
);

-- CreateIndex
CREATE INDEX "roletas_tenant_id_idx" ON "roletas"("tenant_id");

-- CreateIndex
CREATE INDEX "roleta_posicoes_roleta_id_posicao_idx" ON "roleta_posicoes"("roleta_id", "posicao");

-- CreateIndex
CREATE INDEX "roleta_sorteios_roleta_id_created_at_idx" ON "roleta_sorteios"("roleta_id", "created_at");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_empreendimento_id_fkey" FOREIGN KEY ("empreendimento_id") REFERENCES "empreendimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roletas" ADD CONSTRAINT "roletas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roletas" ADD CONSTRAINT "roletas_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_empreendimentos" ADD CONSTRAINT "roleta_empreendimentos_roleta_id_fkey" FOREIGN KEY ("roleta_id") REFERENCES "roletas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_empreendimentos" ADD CONSTRAINT "roleta_empreendimentos_empreendimento_id_fkey" FOREIGN KEY ("empreendimento_id") REFERENCES "empreendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_corretores" ADD CONSTRAINT "roleta_corretores_roleta_id_fkey" FOREIGN KEY ("roleta_id") REFERENCES "roletas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_corretores" ADD CONSTRAINT "roleta_corretores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_posicoes" ADD CONSTRAINT "roleta_posicoes_roleta_id_fkey" FOREIGN KEY ("roleta_id") REFERENCES "roletas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_posicoes" ADD CONSTRAINT "roleta_posicoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_sorteios" ADD CONSTRAINT "roleta_sorteios_roleta_id_fkey" FOREIGN KEY ("roleta_id") REFERENCES "roletas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_sorteios" ADD CONSTRAINT "roleta_sorteios_disparado_por_id_fkey" FOREIGN KEY ("disparado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleta_horario_execucoes" ADD CONSTRAINT "roleta_horario_execucoes_roleta_id_fkey" FOREIGN KEY ("roleta_id") REFERENCES "roletas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
