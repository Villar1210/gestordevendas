-- Remove followUpsEnviados da tabela filas (migration anterior errada)
ALTER TABLE "filas" DROP COLUMN IF EXISTS "followUpsEnviados";

-- Adiciona followUpsEnviados na tabela cards
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "follow_ups_enviados" TEXT[] NOT NULL DEFAULT '{}';
