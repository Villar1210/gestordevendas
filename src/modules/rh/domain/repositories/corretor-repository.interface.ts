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
  // Tambem renova ultimaAtividadeEm (trocar de status e um sinal de vida).
  updateStatusDisponibilidade(userId: string, tenantId: string, status: string): Promise<void>;
  // Presenca automatica: heartbeat do usuario logado. Renova
  // ultimaAtividadeEm e devolve o status ATUAL (o frontend usa para perceber
  // que foi derrubado para "offline" por inatividade). Nulo = usuario nao existe.
  registrarAtividade(userId: string, tenantId: string): Promise<string | null>;
  // Presenca automatica: derruba para "offline" todo usuario "online" sem
  // sinal de vida ha mais que o limite do seu tenant
  // (RoletaConfig.minutosInatividadeOffline, default 15, 0 = desligado).
  // Devolve quem foi derrubado (para log).
  marcarOfflinePorInatividade(): Promise<Array<{ id: string; tenantId: string; name: string }>>;
}
