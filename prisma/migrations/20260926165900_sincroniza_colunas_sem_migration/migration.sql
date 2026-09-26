-- Colunas que ja estavam no schema.prisma (e no banco de producao, via
-- "prisma db push") mas nunca ganharam migration. Sem isto, um banco novo
-- criado so com "prisma migrate deploy" ficava sem estas colunas e o
-- sistema quebrava. IF NOT EXISTS: em producao, onde elas ja existem, nada muda.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsapp" VARCHAR(30);

ALTER TABLE "empreendimentos" ADD COLUMN IF NOT EXISTS "complemento" VARCHAR(100);
ALTER TABLE "empreendimentos" ADD COLUMN IF NOT EXISTS "tipo" VARCHAR(50);
ALTER TABLE "empreendimentos" ADD COLUMN IF NOT EXISTS "construtora" VARCHAR(150);
ALTER TABLE "empreendimentos" ADD COLUMN IF NOT EXISTS "preco_minimo" DOUBLE PRECISION;
ALTER TABLE "empreendimentos" ADD COLUMN IF NOT EXISTS "preco_maximo" DOUBLE PRECISION;

ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "suites" INTEGER;
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "area_total" DOUBLE PRECISION;
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "iptu" DECIMAL(12,2);
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "valor_condominio" DECIMAL(12,2);
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "aceita_financiamento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "aceita_permuta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "link_tour_virtual" VARCHAR(500);
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "area_externa" DOUBLE PRECISION;
