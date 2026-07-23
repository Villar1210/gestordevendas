-- CreateTable
CREATE TABLE "empreendimento_photos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "empreendimento_id" UUID NOT NULL,
    "categoria" VARCHAR(20) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empreendimento_photos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "empreendimento_photos" ADD CONSTRAINT "empreendimento_photos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimento_photos" ADD CONSTRAINT "empreendimento_photos_empreendimento_id_fkey" FOREIGN KEY ("empreendimento_id") REFERENCES "empreendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
