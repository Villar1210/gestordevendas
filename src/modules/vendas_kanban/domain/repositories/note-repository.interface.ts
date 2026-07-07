// src/modules/vendas_kanban/domain/repositories/note-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface NoteRecord {
  id: string;
  tenantId: string;
  cardId: string;
  body: string;
  createdAt: Date;
}

export interface INoteRepository {
  create(input: { tenantId: string; cardId: string; body: string }): Promise<NoteRecord>;
  // Retorna ordenado por createdAt (decrescente - mais recente primeiro).
  findAllByCard(cardId: string): Promise<NoteRecord[]>;
}
