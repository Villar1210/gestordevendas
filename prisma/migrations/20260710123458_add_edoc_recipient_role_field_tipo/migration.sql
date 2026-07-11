-- AlterTable
ALTER TABLE "signature_fields" ADD COLUMN     "tipo" VARCHAR(20) NOT NULL DEFAULT 'assinatura';

-- AlterTable
ALTER TABLE "signature_recipients" ADD COLUMN     "role" VARCHAR(20) NOT NULL DEFAULT 'destinatario';
