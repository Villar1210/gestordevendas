-- CreateTable
CREATE TABLE "filas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_usuarios" (
    "id" UUID NOT NULL,
    "fila_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fila_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "whatsapp_session_id" UUID NOT NULL,
    "remote_jid" VARCHAR(50) NOT NULL,
    "phone_number" VARCHAR(30) NOT NULL,
    "fila_id" UUID,
    "owner_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'aguardando',
    "motivo_fechamento" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento_eventos" (
    "id" UUID NOT NULL,
    "atendimento_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "user_id" UUID,
    "detalhe" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atendimento_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fila_usuarios_fila_id_user_id_key" ON "fila_usuarios"("fila_id", "user_id");

-- AddForeignKey
ALTER TABLE "filas" ADD CONSTRAINT "filas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_usuarios" ADD CONSTRAINT "fila_usuarios_fila_id_fkey" FOREIGN KEY ("fila_id") REFERENCES "filas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_usuarios" ADD CONSTRAINT "fila_usuarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_whatsapp_session_id_fkey" FOREIGN KEY ("whatsapp_session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_fila_id_fkey" FOREIGN KEY ("fila_id") REFERENCES "filas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_eventos" ADD CONSTRAINT "atendimento_eventos_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_eventos" ADD CONSTRAINT "atendimento_eventos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
