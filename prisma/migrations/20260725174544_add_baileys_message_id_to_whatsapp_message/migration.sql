-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "baileys_message_id" VARCHAR(255);

-- CreateIndex
CREATE INDEX "whatsapp_messages_session_id_baileys_message_id_idx" ON "whatsapp_messages"("session_id", "baileys_message_id");
