// test/factories/atendimento-record.factory.ts
import { AtendimentoRecord } from '../../src/modules/atendimento/domain/repositories/atendimento-repository.interface';

export function buildAtendimentoRecord(overrides: Partial<AtendimentoRecord> = {}): AtendimentoRecord {
  const now = new Date();
  return {
    id: 'atendimento-1',
    tenantId: 'tenant-1',
    whatsappSessionId: 'session-1',
    remoteJid: '5511999999999@s.whatsapp.net',
    phoneNumber: '5511999999999',
    filaId: null,
    ownerId: null,
    status: 'aguardando',
    motivoFechamento: null,
    urgente: false,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    escalonamentoNotificadoEm: null,
    ...overrides,
  };
}
