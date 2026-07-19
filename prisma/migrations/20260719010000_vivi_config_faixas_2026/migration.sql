-- RenameColumn: nomenclatura HIS1/HIS2/HMP -> Faixa 1/2/3 (2026)
ALTER TABLE "vivi_configs" RENAME COLUMN "limite_his1" TO "limite_faixa1";
ALTER TABLE "vivi_configs" RENAME COLUMN "limite_his2" TO "limite_faixa2";
ALTER TABLE "vivi_configs" RENAME COLUMN "limite_hmp" TO "limite_faixa3";

-- AddColumn: Faixa 4 (NOVA, MCMV Premium)
ALTER TABLE "vivi_configs" ADD COLUMN "limite_faixa4" DECIMAL(12,2) NOT NULL DEFAULT 13000;

-- AddColumn: detalhes por faixa (subsidio/juros/teto de financiamento/exemplo de parcela)
ALTER TABLE "vivi_configs" ADD COLUMN "faixa1_subsidio_max" DECIMAL(12,2) DEFAULT 55000;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa1_juros_min" DECIMAL(5,2) DEFAULT 4.00;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa1_juros_max" DECIMAL(5,2) DEFAULT 4.50;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa1_teto_financiamento" VARCHAR(100);
ALTER TABLE "vivi_configs" ADD COLUMN "faixa1_exemplo_parcela" VARCHAR(300);

ALTER TABLE "vivi_configs" ADD COLUMN "faixa2_subsidio_max" DECIMAL(12,2) DEFAULT 55000;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa2_juros_min" DECIMAL(5,2) DEFAULT 4.75;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa2_juros_max" DECIMAL(5,2) DEFAULT 6.50;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa2_teto_financiamento" VARCHAR(100) DEFAULT 'R$ 275 mil a R$ 400 mil';
ALTER TABLE "vivi_configs" ADD COLUMN "faixa2_exemplo_parcela" VARCHAR(300);

ALTER TABLE "vivi_configs" ADD COLUMN "faixa3_subsidio_max" DECIMAL(12,2);
ALTER TABLE "vivi_configs" ADD COLUMN "faixa3_juros_min" DECIMAL(5,2) DEFAULT 7.66;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa3_juros_max" DECIMAL(5,2) DEFAULT 7.66;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa3_teto_financiamento" VARCHAR(100) DEFAULT 'R$ 400 mil';
ALTER TABLE "vivi_configs" ADD COLUMN "faixa3_exemplo_parcela" VARCHAR(300);

ALTER TABLE "vivi_configs" ADD COLUMN "faixa4_subsidio_max" DECIMAL(12,2);
ALTER TABLE "vivi_configs" ADD COLUMN "faixa4_juros_min" DECIMAL(5,2) DEFAULT 10.50;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa4_juros_max" DECIMAL(5,2) DEFAULT 10.50;
ALTER TABLE "vivi_configs" ADD COLUMN "faixa4_teto_financiamento" VARCHAR(100) DEFAULT 'R$ 600 mil';
ALTER TABLE "vivi_configs" ADD COLUMN "faixa4_exemplo_parcela" VARCHAR(300);

-- Atualiza os TETOS de renda (colunas renomeadas, dado ja existente) para
-- os novos valores de negocio 2026 - diferente das colunas novas acima
-- (que ja nascem com o DEFAULT correto via ADD COLUMN), estas 3 ja
-- existiam com os valores antigos (2850/4700/8000) e precisam ser
-- sobrescritas explicitamente.
UPDATE "vivi_configs" SET
  "limite_faixa1" = 3200,
  "limite_faixa2" = 5000,
  "limite_faixa3" = 9600;
