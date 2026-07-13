// src/modules/vivi_sdr/domain/repositories/vivi-conversation-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
import { CategoriaHabitacional } from '../services/classificar-renda';

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
  visitaAgendadaEm: Date | null;
  rendaDeclarada: number | null;
  categoriaHabitacional: CategoriaHabitacional | null;
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
  visitaAgendadaEm?: Date;
  rendaDeclarada?: number;
  categoriaHabitacional?: CategoriaHabitacional;
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
  // A conversa mais recente (qualquer status) para este numero nesta sessao.
  // Usado pela VIVI para detectar leads ja transferidos: se a conversa mais
  // recente nao esta "em_andamento", o lead ja foi encaminhado - nao criar
  // uma nova conversa e nao responder.
  findLatestBySessionAndPhone(
    whatsappSessionId: string,
    phoneNumber: string,
  ): Promise<ViviConversationRecord | null>;
  update(id: string, data: ViviConversationUpdateInput): Promise<ViviConversationRecord>;
  findAllByTenant(tenantId: string): Promise<ViviConversationRecord[]>;
}
