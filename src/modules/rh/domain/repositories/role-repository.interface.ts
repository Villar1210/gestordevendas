// src/modules/rh/domain/repositories/role-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface RoleRecord {
  id: string;
  tenantId: string;
  name: string;
}

export interface IRoleRepository {
  findByTenantAndName(tenantId: string, name: string): Promise<RoleRecord | null>;
  create(input: { tenantId: string; name: string }): Promise<RoleRecord>;
}
