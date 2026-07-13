// src/modules/atendimento/domain/repositories/atendimento-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface AtendimentoRecord {
  id: string;
  tenantId: string;
  whatsappSessionId: string;
  remoteJid: string;
  phoneNumber: string;
  filaId: string | null;
  ownerId: string | null;
  status: string;
  motivoFechamento: string | null;
  urgente: boolean;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface AtendimentoWithNames extends AtendimentoRecord {
  filaNome: string | null;
  ownerName: string | null;
}

// Filtros de listagem: filaId/status/ownerId narrowam por igualdade.
// visibleFilaIds/visibleOwnerId sao o ESCOPO de visibilidade de um agente
// nao-Administrador (ve atendimentos cujo filaId esteja em visibleFilaIds
// OU cujo ownerId seja visibleOwnerId) - ausentes quando quem pede e
// Administrador (sem restricao de escopo).
export interface ListAtendimentosFilter {
  filaId?: string;
  status?: string;
  ownerId?: string;
  visibleFilaIds?: string[];
  visibleOwnerId?: string;
}

export interface IAtendimentoRepository {
  create(input: {
    tenantId: string;
    whatsappSessionId: string;
    remoteJid: string;
    phoneNumber: string;
  }): Promise<AtendimentoRecord>;
  // Atendimento em aberto (status != "fechado") para esse contato, dentro
  // da mesma sessao - usado por GetOrCreateAtendimentoUseCase.
  findActiveBySessionAndRemoteJid(
    sessionId: string,
    remoteJid: string,
  ): Promise<AtendimentoRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<AtendimentoRecord | null>;
  update(
    id: string,
    data: Partial<{
      filaId: string | null;
      ownerId: string | null;
      status: string;
      motivoFechamento: string | null;
      closedAt: Date | null;
      urgente: boolean;
    }>,
  ): Promise<AtendimentoRecord>;
  findAllByTenant(tenantId: string, filter: ListAtendimentosFilter): Promise<AtendimentoWithNames[]>;
}
