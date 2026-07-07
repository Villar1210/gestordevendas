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
}
