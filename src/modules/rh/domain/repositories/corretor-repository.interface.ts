// src/modules/rh/domain/repositories/corretor-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface CorretorRecord {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  statusDisponibilidade: string;
  telefone: string | null;
  whatsapp: string | null;
  creci: string | null;
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
    telefone?: string | null;
    whatsapp?: string | null;
    creci?: string | null;
  }): Promise<CorretorRecord>;
  findAllByTenantAndRole(tenantId: string, roleId: string): Promise<CorretorRecord[]>;
  findOnlineByTenantAndRole(tenantId: string, roleId: string): Promise<CorretorRecord[]>;
  updateStatusDisponibilidade(userId: string, tenantId: string, status: string): Promise<void>;
}
