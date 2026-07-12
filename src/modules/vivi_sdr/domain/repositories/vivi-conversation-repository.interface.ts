// src/modules/vivi_sdr/domain/repositories/vivi-conversation-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export type ViviConversationStatus =
  | 'em_andamento'
  | 'qualificado_transferido'
  | 'duvida_transferido'
  | 'encaminhado_fila'
  | 'encerrada';

export interface ViviConversationRecord {
  id: string;
  tenantId: string;
  whatsappSessionId: string;
  phoneNumber: string;
  status: ViviConversationStatus;
  nomeColetado: string | null;
  tipoImovelColetado: string | null;
  orcamentoColetado: string | null;
  regiaoColetado: string | null;
  finalidadeColetado: string | null;
  cardId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViviConversationUpdateInput {
  status?: ViviConversationStatus;
  nomeColetado?: string;
  tipoImovelColetado?: string;
  orcamentoColetado?: string;
  regiaoColetado?: string;
  finalidadeColetado?: string;
  cardId?: string;
}

export interface IViviConversationRepository {
  create(input: {
    tenantId: string;
    whatsappSessionId: string;
    phoneNumber: string;
  }): Promise<ViviConversationRecord>;
  // Conversa ainda "em_andamento" (nao concluida/transferida) para este
  // numero nesta sessao - se existir, a proxima mensagem continua ela.
  findActiveBySessionAndPhone(
    whatsappSessionId: string,
    phoneNumber: string,
  ): Promise<ViviConversationRecord | null>;
  update(id: string, data: ViviConversationUpdateInput): Promise<ViviConversationRecord>;
  findAllByTenant(tenantId: string): Promise<ViviConversationRecord[]>;
}
