-- Motor de campanha de remarketing escalonada do Repique. Migracao aditiva
-- (2 colunas nullable/default em cards + 1 tabela nova) - baixo risco,
-- mesma categoria das migracoes anteriores desta leva.

ALTER TABLE "cards" ADD COLUMN "repique_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cards" ADD COLUMN "repique_opt_out_token" VARCHAR(64);

CREATE UNIQUE INDEX "cards_repique_opt_out_token_key" ON "cards"("repique_opt_out_token");

CREATE TABLE "repique_campanha_envios" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo_repique_no_envio" VARCHAR(30),
    "sucesso" BOOLEAN NOT NULL,
    "erro_mensagem" TEXT,

    CONSTRAINT "repique_campanha_envios_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "repique_campanha_envios" ADD CONSTRAINT "repique_campanha_envios_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repique_campanha_envios" ADD CONSTRAINT "repique_campanha_envios_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
