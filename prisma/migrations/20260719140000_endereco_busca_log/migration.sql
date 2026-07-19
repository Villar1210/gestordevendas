-- VIVI Fatia 2 (Desenvolvimento Tecnologico) - item 2: busca de
-- empreendimento por endereco. Migracao aditiva (tabela nova) - baixo
-- risco, mesma categoria da migracao do timeout de aceite da Roleta.

CREATE TABLE "endereco_busca_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "phone_number" VARCHAR(30) NOT NULL,
    "endereco_buscado" VARCHAR(300) NOT NULL,
    "encontrado_catalogo" BOOLEAN NOT NULL,
    "nome_encontrado_catalogo" VARCHAR(200),
    "precisou_busca_externa" BOOLEAN NOT NULL DEFAULT false,
    "confirmado_externamente" BOOLEAN,
    "nome_encontrado_externo" VARCHAR(200),
    "escalonado" BOOLEAN NOT NULL DEFAULT false,
    "motivo_escalonamento" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endereco_busca_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "endereco_busca_logs" ADD CONSTRAINT "endereco_busca_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
