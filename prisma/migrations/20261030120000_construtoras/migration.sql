-- Construtoras (Fatia A): cadastro de construtoras/incorporadoras por tenant
-- e vinculo opcional no empreendimento. So CREATE TABLE / ADD COLUMN /
-- INDEX + backfill. A coluna texto "empreendimentos.construtora" NAO e
-- apagada nem alterada (site publico, BII e book ainda leem).
--
-- Normalizacao do nome (tem de bater com normalizarNomeConstrutora em
-- src/modules/gestao_imobiliaria/domain/services/construtora.ts):
--   1. acentos comuns -> letra base (translate; sem extensao unaccent, que
--      nao existe neste banco) + remove marcas combinantes U+0300-U+036F
--      (texto ja decomposto);
--   2. minusculas;
--   3. espacos (inclusive U+00A0) colapsados em um so;
--   4. trim.

-- CreateTable
CREATE TABLE "construtoras" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "nome_normalizado" VARCHAR(150) NOT NULL,
    "site" VARCHAR(255),
    "sobre" VARCHAR(2000),
    "diferenciais" VARCHAR(1500),
    "logo_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "construtoras_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "empreendimentos" ADD COLUMN "construtora_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "construtoras_tenant_id_nome_normalizado_key" ON "construtoras"("tenant_id", "nome_normalizado");

-- CreateIndex
CREATE INDEX "construtoras_tenant_id_nome_idx" ON "construtoras"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "empreendimentos_tenant_id_construtora_id_idx" ON "empreendimentos"("tenant_id", "construtora_id");

-- AddForeignKey
ALTER TABLE "construtoras" ADD CONSTRAINT "construtoras_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimentos" ADD CONSTRAINT "empreendimentos_construtora_id_fkey" FOREIGN KEY ("construtora_id") REFERENCES "construtoras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill 1/2: uma Construtora por (tenant, nome normalizado) a partir do
-- texto livre ja gravado nos empreendimentos. Nome = grafia mais usada no
-- grupo (empate: a que apareceu primeiro, depois ordem alfabetica). Tudo
-- agrupado por tenant_id: um tenant nunca enxerga a grafia de outro.
WITH base AS (
    SELECT
        e."tenant_id",
        e."created_at",
        btrim(regexp_replace(e."construtora", '[[:space:] ]+', ' ', 'g')) AS grafia
    FROM "empreendimentos" e
    WHERE e."construtora" IS NOT NULL
),
normalizada AS (
    SELECT
        b."tenant_id",
        b."created_at",
        b.grafia,
        btrim(regexp_replace(
            lower(regexp_replace(
                translate(
                    b.grafia,
                    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑýÿÝ',
                    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY'
                ),
                '[̀-ͯ]', '', 'g'
            )),
            '[[:space:] ]+', ' ', 'g'
        )) AS nome_normalizado
    FROM base b
    WHERE b.grafia <> ''
),
contagem AS (
    SELECT
        n."tenant_id",
        n.nome_normalizado,
        n.grafia,
        COUNT(*) AS quantidade,
        MIN(n."created_at") AS primeira_vez
    FROM normalizada n
    WHERE n.nome_normalizado <> ''
    GROUP BY n."tenant_id", n.nome_normalizado, n.grafia
),
escolhida AS (
    SELECT DISTINCT ON (c."tenant_id", c.nome_normalizado)
        c."tenant_id",
        c.nome_normalizado,
        c.grafia
    FROM contagem c
    ORDER BY c."tenant_id", c.nome_normalizado, c.quantidade DESC, c.primeira_vez ASC, c.grafia ASC
)
INSERT INTO "construtoras" ("id", "tenant_id", "nome", "nome_normalizado", "created_at", "updated_at")
SELECT gen_random_uuid(), es."tenant_id", es.grafia, es.nome_normalizado, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM escolhida es;

-- Backfill 2/2: liga cada empreendimento a construtora do PROPRIO tenant
-- com o mesmo nome normalizado (mesma expressao do passo 1).
UPDATE "empreendimentos" e
SET "construtora_id" = c."id"
FROM "construtoras" c
WHERE c."tenant_id" = e."tenant_id"
  AND e."construtora" IS NOT NULL
  AND e."construtora_id" IS NULL
  AND c."nome_normalizado" = btrim(regexp_replace(
        lower(regexp_replace(
            translate(
                btrim(regexp_replace(e."construtora", '[[:space:] ]+', ' ', 'g')),
                'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑýÿÝ',
                'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY'
            ),
            '[̀-ͯ]', '', 'g'
        )),
        '[[:space:] ]+', ' ', 'g'
      ));
