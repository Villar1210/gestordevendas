// src/modules/rh/domain/repositories/corretor-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface CorretorRecord {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  statusDisponibilidade: string;
  createdAt: Date;
}

export interface ICorretorRepository {
  findByEmail(email: string): Promise<{ id: string } | null>;
  create(input: {
    tenantId: string;
    roleId: string;
    name: string;
    email: string;
    hashedPassword: string;
  }): Promise<CorretorRecord>;
  // Lista usuarios do tenant vinculados ao Role informado (roleId do Role "Corretor").
  findAllByTenantAndRole(tenantId: string, roleId: string): Promise<CorretorRecord[]>;
  // Mesma coisa, mas so os com statusDisponibilidade = "online" - usado pela
  // Roleta Online para saber quem pode receber um lead agora.
  findOnlineByTenantAndRole(tenantId: string, roleId: string): Promise<CorretorRecord[]>;
  updateStatusDisponibilidade(userId: string, tenantId: string, status: string): Promise<void>;
}
