// src/modules/vivi_sdr/domain/repositories/social-conversation-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
// Papel paralelo ao de IViviConversationRepository, mas chaveado por
// socialAccountId + identificadorExterno (PSID/IGSID) em vez de
// whatsappSessionId + phoneNumber - ver comentario do model
// SocialConversation em schema.prisma para o motivo de nao generalizar
// ViviConversation.
import { CategoriaHabitacional } from '../services/classificar-renda';
import { ViviConversationStatus, TipoRenda } from './vivi-conversation-repository.interface';

export interface SocialConversationRecord {
  id: string;
  tenantId: string;
  socialAccountId: string;
  identificadorExterno: string;
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
  dataNascimento: string | null;
  email: string | null;
  tipoRenda: TipoRenda | null;
  fezDeclaracaoIR: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialConversationUpdateInput {
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
  dataNascimento?: string;
  email?: string;
  tipoRenda?: TipoRenda;
  fezDeclaracaoIR?: boolean;
}

export interface ISocialConversationRepository {
  create(input: {
    tenantId: string;
    socialAccountId: string;
    identificadorExterno: string;
  }): Promise<SocialConversationRecord>;
  findActiveByAccountAndExternalId(
    socialAccountId: string,
    identificadorExterno: string,
  ): Promise<SocialConversationRecord | null>;
  findLatestByAccountAndExternalId(
    socialAccountId: string,
    identificadorExterno: string,
  ): Promise<SocialConversationRecord | null>;
  update(id: string, data: SocialConversationUpdateInput): Promise<SocialConversationRecord>;
}
