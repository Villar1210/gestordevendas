-- VIVI Fatia 2 (Desenvolvimento Tecnologico) - item 1: timeout de aceite
-- da Roleta Online. Migracao totalmente aditiva (nenhuma coluna renomeada
-- ou removida) - baixo risco, ao contrario da migracao da VIVI Fatia 1.

-- Card: rastreio do timeout de aceite (modo automatico da Roleta Online)
ALTER TABLE "cards" ADD COLUMN "atribuido_automaticamente_em" TIMESTAMP(3);
ALTER TABLE "cards" ADD COLUMN "aceito_em" TIMESTAMP(3);

-- RoletaConfig: minutos configuraveis antes de reatribuir (default 5)
ALTER TABLE "roleta_configs" ADD COLUMN "timeout_aceite_minutos" INTEGER NOT NULL DEFAULT 5;
