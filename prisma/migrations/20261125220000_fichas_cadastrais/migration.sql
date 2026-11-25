-- RH - cadastro completo da equipe interna (25/11/2026). So aditiva.
CREATE TABLE "fichas_cadastrais" (
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "indicado_por" VARCHAR(150) NOT NULL,
    "cargo_pretendido" VARCHAR(40) NOT NULL,
    "ja_trabalhou_no_grupo" BOOLEAN NOT NULL,
    "superior_indicado_id" UUID,
    "rg" VARCHAR(30) NOT NULL,
    "rg_uf" VARCHAR(2) NOT NULL,
    "nome_mae" VARCHAR(150) NOT NULL,
    "nome_pai" VARCHAR(150) NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "pais_nascimento" VARCHAR(60) NOT NULL,
    "estado_nascimento" VARCHAR(40) NOT NULL,
    "cidade_nascimento" VARCHAR(80) NOT NULL,
    "estado_civil" VARCHAR(20) NOT NULL,
    "nome_conjuge" VARCHAR(150),
    "quantidade_filhos" VARCHAR(12) NOT NULL,
    "rua" VARCHAR(150) NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "bairro" VARCHAR(80) NOT NULL,
    "cidade" VARCHAR(80) NOT NULL,
    "cep" VARCHAR(9) NOT NULL,
    "escolaridade" VARCHAR(40) NOT NULL,
    "possui_creci" BOOLEAN NOT NULL,
    "creci_tipo" VARCHAR(12),
    "creci_numero" VARCHAR(30),
    "creci_validade" DATE,
    "creci_supervisor" VARCHAR(150),
    "banco" VARCHAR(60) NOT NULL,
    "agencia" VARCHAR(10) NOT NULL,
    "conta" VARCHAR(20) NOT NULL,
    "tipo_conta" VARCHAR(10) NOT NULL,
    "tipo_pix" VARCHAR(10) NOT NULL,
    "chave_pix" VARCHAR(80) NOT NULL,
    "opta_pj" BOOLEAN NOT NULL,
    "cnpj" VARCHAR(18),
    "pj_banco" VARCHAR(60),
    "pj_agencia" VARCHAR(10),
    "pj_conta" VARCHAR(20),
    "tamanho_camisa" VARCHAR(3) NOT NULL,
    "aceite_lgpd_em" TIMESTAMP(3) NOT NULL,
    "motivo_recusa" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fichas_cadastrais_pkey" PRIMARY KEY ("user_id")
);
CREATE INDEX "fichas_cadastrais_tenant_id_idx" ON "fichas_cadastrais"("tenant_id");
ALTER TABLE "fichas_cadastrais" ADD CONSTRAINT "fichas_cadastrais_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fichas_cadastrais" ADD CONSTRAINT "fichas_cadastrais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fichas_cadastrais" ADD CONSTRAINT "fichas_cadastrais_superior_indicado_id_fkey" FOREIGN KEY ("superior_indicado_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ficha_acessos_sensiveis" (
    "id" UUID NOT NULL,
    "titular_id" UUID NOT NULL,
    "leitor_id" UUID NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ficha_acessos_sensiveis_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ficha_acessos_sensiveis_titular_id_em_idx" ON "ficha_acessos_sensiveis"("titular_id", "em");
ALTER TABLE "ficha_acessos_sensiveis" ADD CONSTRAINT "ficha_acessos_sensiveis_titular_id_fkey" FOREIGN KEY ("titular_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ficha_acessos_sensiveis" ADD CONSTRAINT "ficha_acessos_sensiveis_leitor_id_fkey" FOREIGN KEY ("leitor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
