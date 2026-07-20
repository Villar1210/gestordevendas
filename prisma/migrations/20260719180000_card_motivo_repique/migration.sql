-- Fatia Repique (motivo + job de inatividade 90 dias). Migracao aditiva
-- (2 colunas nullable novas) - baixo risco, mesma categoria das migracoes
-- anteriores desta leva (timeout da Roleta, EnderecoBuscaLog).

ALTER TABLE "cards" ADD COLUMN "motivo_repique" VARCHAR(30);
ALTER TABLE "cards" ADD COLUMN "movido_para_repique_em" TIMESTAMP(3);
