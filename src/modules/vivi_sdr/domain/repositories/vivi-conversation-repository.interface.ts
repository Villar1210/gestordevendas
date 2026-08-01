// src/modules/vivi_sdr/domain/repositories/vivi-conversation-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
import { CategoriaHabitacional } from '../services/classificar-renda';

export type ViviConversationStatus =
  | 'em_andamento'
  | 'qualificado_transferido'
  | 'duvida_transferido'
  | 'encaminhado_fila'
  // Renda declarada classificada como SEM_PERFIL (ver classificar-renda.ts) -
  // Card criado direto na coluna "Repique" do Kanban (deposito estrategico
  // para remarketing futuro), NAO uma Fila da Central de Atendimento.
  | 'repique'
  // Lead pediu um imovel/empreendimento/bairro fora do portfolio do tenant
  // (motivo "fora_do_portfolio" de transferir_para_corretor) - status
  // separado de qualificado_transferido de proposito, para permitir medir
  // essa demanda separadamente (decisao de negocio: avaliar expansao de
  // portfolio ou oportunidade perdida).
  | 'fora_do_portfolio_transferido'
  | 'encerrada';

export type TipoRenda = 'CLT' | 'AUTONOMO';

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
  dataNascimento: string | null;
  email: string | null;
  tipoRenda: TipoRenda | null;
  fezDeclaracaoIR: boolean | null;
  // Integracao VIVI (2026) - preenchido quando "buscar_empreendimento_por_
  // endereco" encontra um Empreendimento no catalogo proprio (nunca para
  // Imovel avulso). Ver AgendarVisitaUseCase (mensagem de confirmacao).
  empreendimentoId: string | null;
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
  dataNascimento?: string;
  email?: string;
  tipoRenda?: TipoRenda;
  fezDeclaracaoIR?: boolean;
  empreendimentoId?: string;
}

export interface IViviConversationRepository {
  // Lanca UniqueConstraintViolationError (ver shared/domain/errors) se ja
  // existir uma conversa "em_andamento" para esta sessao+telefone (indice
  // unico parcial, ver schema.prisma) - protege contra mensagens
  // concorrentes do mesmo lead criando conversas duplicadas (achado C2).
  // Ver ProcessIncomingMessageUseCase.findOrCreateConversation para o
  // tratamento (busca de novo em vez de propagar).
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
