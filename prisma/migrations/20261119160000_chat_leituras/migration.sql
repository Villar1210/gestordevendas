-- WhatsApp integrado - Etapa 3 (19/11/2026): leitura das conversas por usuario
-- (contador de nao lidas). So aditiva.
CREATE TABLE "chat_leituras" (
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "lido_ate" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_leituras_pkey" PRIMARY KEY ("user_id","card_id")
);
CREATE INDEX "chat_leituras_card_id_idx" ON "chat_leituras"("card_id");
ALTER TABLE "chat_leituras" ADD CONSTRAINT "chat_leituras_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_leituras" ADD CONSTRAINT "chat_leituras_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
