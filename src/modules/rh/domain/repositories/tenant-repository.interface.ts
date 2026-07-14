// src/modules/rh/domain/repositories/tenant-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
// So o minimo necessario para qualificar o CONTRATANTE no contrato de
// prestacao de servico - Tenant hoje nao tem CNPJ/endereco proprios, so o
// nome esta disponivel.
export interface ITenantRepository {
  findNameById(tenantId: string): Promise<string | null>;
}
