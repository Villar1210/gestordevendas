-- CreateTable
CREATE TABLE "acessos_plataforma_log" (
    "id" UUID NOT NULL,
    "super_usuario_id" UUID NOT NULL,
    "tenant_id" UUID,
    "tenant_nome" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acessos_plataforma_log_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "acessos_plataforma_log" ADD CONSTRAINT "acessos_plataforma_log_super_usuario_id_fkey" FOREIGN KEY ("super_usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_plataforma_log" ADD CONSTRAINT "acessos_plataforma_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
