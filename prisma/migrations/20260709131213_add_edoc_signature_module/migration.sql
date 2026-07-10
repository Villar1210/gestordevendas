-- CreateTable
CREATE TABLE "signature_envelopes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    "document_url" VARCHAR(500) NOT NULL,
    "document_hash" VARCHAR(64) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "signature_envelopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_recipients" (
    "id" UUID NOT NULL,
    "envelope_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "order" INTEGER NOT NULL,
    "access_token" VARCHAR(255),
    "token_expires_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "signed_at" TIMESTAMP(3),
    "signature_image_data" TEXT,
    "signature_hash" VARCHAR(64),
    "signer_ip" VARCHAR(45),
    "signer_user_agent" VARCHAR(500),

    CONSTRAINT "signature_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_events" (
    "id" UUID NOT NULL,
    "envelope_id" UUID NOT NULL,
    "recipient_id" UUID,
    "type" VARCHAR(30) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signature_recipients_access_token_key" ON "signature_recipients"("access_token");

-- AddForeignKey
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_recipients" ADD CONSTRAINT "signature_recipients_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "signature_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "signature_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "signature_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
