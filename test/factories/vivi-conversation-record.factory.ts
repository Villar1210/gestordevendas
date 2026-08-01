// test/factories/vivi-conversation-record.factory.ts
import { ViviConversationRecord } from '../../src/modules/vivi_sdr/domain/repositories/vivi-conversation-repository.interface';

export function buildViviConversationRecord(
  overrides: Partial<ViviConversationRecord> = {},
): ViviConversationRecord {
  const now = new Date();
  return {
    id: 'conversa-1',
    tenantId: 'tenant-1',
    whatsappSessionId: 'session-1',
    phoneNumber: '5511999999999',
    status: 'em_andamento',
    nomeColetado: null,
    tipoImovelColetado: null,
    orcamentoColetado: null,
    regiaoColetado: null,
    finalidadeColetado: null,
    cardId: null,
    visitaAgendadaEm: null,
    rendaDeclarada: null,
    categoriaHabitacional: null,
    dataNascimento: null,
    email: null,
    tipoRenda: null,
    fezDeclaracaoIR: null,
    empreendimentoId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
