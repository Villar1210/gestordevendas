// src/modules/rh/domain/repositories/contrato-template-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
export interface ContratoTemplateRecord {
  id: string;
  tenantId: string;
  nome: string;
  corpo: string;
  padrao: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContratoTemplateRepository {
  create(input: { tenantId: string; nome: string; corpo: string }): Promise<ContratoTemplateRecord>;
  findPadraoByTenant(tenantId: string): Promise<ContratoTemplateRecord | null>;
}
