-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "bairro" VARCHAR(100),
ADD COLUMN     "cep" VARCHAR(10),
ADD COLUMN     "cnpj" VARCHAR(20),
ADD COLUMN     "complemento" VARCHAR(100),
ADD COLUMN     "endereco" VARCHAR(200),
ADD COLUMN     "numero" VARCHAR(20);
