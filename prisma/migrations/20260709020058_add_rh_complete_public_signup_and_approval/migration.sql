-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cargo_hierarquico" VARCHAR(30),
ADD COLUMN     "cargo_na_empresa" VARCHAR(100),
ADD COLUMN     "cep" VARCHAR(10),
ADD COLUMN     "cnpj" VARCHAR(20),
ADD COLUMN     "cpf" VARCHAR(20),
ADD COLUMN     "creci" VARCHAR(30),
ADD COLUMN     "creci_j" VARCHAR(30),
ADD COLUMN     "endereco" VARCHAR(200),
ADD COLUMN     "nome_imobiliaria" VARCHAR(150),
ADD COLUMN     "status_cadastro" VARCHAR(20) NOT NULL DEFAULT 'aprovado',
ADD COLUMN     "superior_id" UUID,
ADD COLUMN     "telefone" VARCHAR(30),
ADD COLUMN     "tipo_cliente" VARCHAR(20);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_superior_id_fkey" FOREIGN KEY ("superior_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
