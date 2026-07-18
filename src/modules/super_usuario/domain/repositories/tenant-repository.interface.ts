// src/modules/super_usuario/domain/repositories/tenant-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
// UNICO lugar do sistema com uma leitura CROSS-TENANT deliberada - ver
// ListTenantsUseCase/ImpersonarTenantUseCase (modulo super_usuario).

export interface TenantSummary {
  id: string;
  name: string;
  cnpj: string | null;
  createdAt: Date;
  totalUsuarios: number;
}

export interface ITenantRepository {
  // Nunca inclui o tenant "Plataforma" (o proprio tenant do Super
  // Usuario) - ver PLATAFORMA_TENANT_NOME.
  findAllExceptPlataforma(): Promise<TenantSummary[]>;
  findByIdExceptPlataforma(id: string): Promise<TenantSummary | null>;
}
