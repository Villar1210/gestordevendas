// src/modules/vendas_kanban/domain/repositories/activity-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface ActivityRecord {
  id: string;
  tenantId: string;
  cardId: string;
  type: string;
  subject: string | null;
  scheduledAt: Date | null;
  done: boolean;
  createdAt: Date;
  // So preenchidos pela consulta do Dashboard do Corretor
  // (findPendingTodayByOwner), que faz o join com o titulo/pipeline do card
  // - cardPipelineId permite o frontend montar o link de volta pro Kanban
  // (/dashboard/kanban?pipelineId=...&cardId=...).
  cardTitle?: string;
  cardPipelineId?: string;
}

export interface IActivityRepository {
  create(input: {
    tenantId: string;
    cardId: string;
    type: string;
    subject?: string | null;
    scheduledAt?: Date | null;
  }): Promise<ActivityRecord>;
  findById(id: string): Promise<ActivityRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<ActivityRecord | null>;
  // Retorna ordenado por scheduledAt (crescente, nulos por ultimo).
  findAllByCard(cardId: string): Promise<ActivityRecord[]>;
  setDone(id: string, done: boolean): Promise<ActivityRecord>;
  // Usado pelo Dashboard do Corretor: atividades agendadas para HOJE (fuso
  // local do processo, mesma logica ja usada em date-only.util.ts) ainda
  // nao concluidas, dos cards de um dono especifico. Ordenado por
  // scheduledAt crescente.
  findPendingTodayByOwner(tenantId: string, ownerId: string): Promise<ActivityRecord[]>;
}
