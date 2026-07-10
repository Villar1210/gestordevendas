-- AlterTable
ALTER TABLE "signature_envelopes" ADD COLUMN     "signed_document_url" VARCHAR(500);

-- CreateTable
CREATE TABLE "signature_fields" (
    "id" UUID NOT NULL,
    "envelope_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "x_percent" DOUBLE PRECISION NOT NULL,
    "y_percent" DOUBLE PRECISION NOT NULL,
    "width_percent" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "height_percent" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_fields_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "signature_fields" ADD CONSTRAINT "signature_fields_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "signature_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_fields" ADD CONSTRAINT "signature_fields_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "signature_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
