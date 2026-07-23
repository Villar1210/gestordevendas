// src/modules/gestao_imobiliaria/domain/repositories/empreendimento-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface EmpreendimentoRecord {
  id: string;
  tenantId: string;
  name: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  description: string | null;
  createdAt: Date;
  // Fatia 1 (schema) + Fatia 3a (importacao de planilha, primeiro consumidor
  // real): publicado controla se o empreendimento aparece no site publico
  // (fora do escopo ainda); origemImportacao registra como os dados
  // chegaram (ex: "planilha") - nulo para empreendimentos cadastrados a mao.
  publicado: boolean;
  origemImportacao: string | null;
}

export interface IEmpreendimentoRepository {
  create(input: {
    tenantId: string;
    name: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    description?: string | null;
  }): Promise<EmpreendimentoRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<EmpreendimentoRecord | null>;
  findAllByTenant(tenantId: string): Promise<EmpreendimentoRecord[]>;
  update(
    id: string,
    patch: { publicado?: boolean; origemImportacao?: string | null },
  ): Promise<EmpreendimentoRecord>;
}
