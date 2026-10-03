-- Fatia 1 (Atendimento/Roleta): presenca automatica
ALTER TABLE "users" ADD COLUMN "ultima_atividade_em" TIMESTAMP(3);
ALTER TABLE "roleta_configs" ADD COLUMN "minutos_inatividade_offline" INTEGER NOT NULL DEFAULT 15;

-- Quem ja esta "online" no momento do deploy ganha o prazo cheio a partir de
-- agora (sem isso, seria derrubado no primeiro minuto por ter o campo nulo).
UPDATE "users" SET "ultima_atividade_em" = CURRENT_TIMESTAMP WHERE "status_disponibilidade" = 'online';
