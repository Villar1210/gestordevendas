// src/modules/atendimento/domain/repositories/atendimento-evento-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface AtendimentoEventoRecord {
  id: string;
  atendimentoId: string;
  tipo: string;
  userId: string | null;
  userName: string | null;
  detalhe: string | null;
  createdAt: Date;
}

export interface IAtendimentoEventoRepository {
  create(input: {
    atendimentoId: string;
    tipo: string;
    userId?: string | null;
    detalhe?: string | null;
  }): Promise<AtendimentoEventoRecord>;
  findAllByAtendimento(atendimentoId: string): Promise<AtendimentoEventoRecord[]>;
}
