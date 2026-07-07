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
}
