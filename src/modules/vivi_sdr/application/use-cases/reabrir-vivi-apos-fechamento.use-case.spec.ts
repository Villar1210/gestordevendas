// Corrige o caso real observado em producao (25/07/2026): ViviConversation
// ficava travada em "encaminhado_fila" para sempre, mesmo com o Atendimento
// associado ja fechado - o Guard 1 de ProcessIncomingMessageUseCase nunca
// mais deixava a VIVI responder aquele numero. Unitario: mocka
// IAtendimentoRepository/IViviConversationRepository - o que importa aqui e
// a DECISAO (reabrir vs nao reabrir), nao o banco em si.
import { ReabrirViviAposFechamentoUseCase } from './reabrir-vivi-apos-fechamento.use-case';
import { IAtendimentoRepository } from '../../../atendimento/domain/repositories/atendimento-repository.interface';
import { IViviConversationRepository } from '../../domain/repositories/vivi-conversation-repository.interface';
import { buildViviConversationRecord } from '../../../../../test/factories/vivi-conversation-record.factory';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';

function setup() {
  const atendimentoRepository = { findActiveBySessionAndRemoteJid: jest.fn() };
  const viviConversationRepository = {
    findLatestBySessionAndPhone: jest.fn(),
    update: jest.fn(),
  };

  const useCase = new ReabrirViviAposFechamentoUseCase(
    atendimentoRepository as unknown as IAtendimentoRepository,
    viviConversationRepository as unknown as IViviConversationRepository,
  );

  const input = {
    tenantId: 'tenant-1',
    whatsappSessionId: 'session-1',
    remoteJid: '5511999990000@s.whatsapp.net',
    phoneNumber: '5511999990000',
    motivoFechamento: null as string | null,
  };

  return { useCase, atendimentoRepository, viviConversationRepository, input };
}

describe('ReabrirViviAposFechamentoUseCase', () => {
  it('CENARIO COMPLETO: sem outro atendimento aberto + conversa encaminhado_fila -> reverte para "encerrada" (libera a VIVI para a proxima mensagem)', async () => {
    const { useCase, atendimentoRepository, viviConversationRepository, input } = setup();
    atendimentoRepository.findActiveBySessionAndRemoteJid.mockResolvedValue(null);
    const conversation = buildViviConversationRecord({ id: 'conversa-1', status: 'encaminhado_fila' });
    viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(conversation);
    viviConversationRepository.update.mockResolvedValue({ ...conversation, status: 'encerrada' });

    await useCase.execute(input);

    expect(atendimentoRepository.findActiveBySessionAndRemoteJid).toHaveBeenCalledWith(
      'session-1',
      '5511999990000@s.whatsapp.net',
    );
    expect(viviConversationRepository.update).toHaveBeenCalledWith('conversa-1', { status: 'encerrada' });
  });

  it('NAO-REGRESSAO: se ainda houver outro atendimento aberto para o mesmo contato, NAO reabre (evita atropelar um segundo atendimento em andamento)', async () => {
    const { useCase, atendimentoRepository, viviConversationRepository, input } = setup();
    atendimentoRepository.findActiveBySessionAndRemoteJid.mockResolvedValue(
      buildAtendimentoRecord({ id: 'outro-atendimento-aberto', status: 'em_atendimento' }),
    );

    await useCase.execute(input);

    expect(viviConversationRepository.findLatestBySessionAndPhone).not.toHaveBeenCalled();
    expect(viviConversationRepository.update).not.toHaveBeenCalled();
  });

  it('conversa NAO esta em encaminhado_fila (ex: ja em_andamento): nao mexe, evita sobrescrever um ciclo ja ativo', async () => {
    const { useCase, atendimentoRepository, viviConversationRepository, input } = setup();
    atendimentoRepository.findActiveBySessionAndRemoteJid.mockResolvedValue(null);
    viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(
      buildViviConversationRecord({ status: 'em_andamento' }),
    );

    await useCase.execute(input);

    expect(viviConversationRepository.update).not.toHaveBeenCalled();
  });

  it('conversa em status de handoff bem-sucedido (qualificado_transferido) fica fora do escopo desta correcao - nao reabre', async () => {
    const { useCase, atendimentoRepository, viviConversationRepository, input } = setup();
    atendimentoRepository.findActiveBySessionAndRemoteJid.mockResolvedValue(null);
    viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(
      buildViviConversationRecord({ status: 'qualificado_transferido' }),
    );

    await useCase.execute(input);

    expect(viviConversationRepository.update).not.toHaveBeenCalled();
  });

  it('nenhuma ViviConversation encontrada para o numero: no-op, sem erro', async () => {
    const { useCase, atendimentoRepository, viviConversationRepository, input } = setup();
    atendimentoRepository.findActiveBySessionAndRemoteJid.mockResolvedValue(null);
    viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(null);

    await expect(useCase.execute(input)).resolves.not.toThrow();
    expect(viviConversationRepository.update).not.toHaveBeenCalled();
  });

  // I8a da auditoria: motivoFechamento de NEGOCIO bloqueia a reabertura
  // mesmo com o sinal tecnico (status=encaminhado_fila) presente.
  it.each(['venda_concluida', 'desistencia', 'finalizacao_normal'])(
    'motivoFechamento="%s": NUNCA reabre, mesmo com sinal tecnico presente (sem outro atendimento aberto + conversa encaminhado_fila)',
    async (motivoFechamento) => {
      const { useCase, atendimentoRepository, viviConversationRepository, input } = setup();
      atendimentoRepository.findActiveBySessionAndRemoteJid.mockResolvedValue(null);
      viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(
        buildViviConversationRecord({ status: 'encaminhado_fila' }),
      );

      await useCase.execute({ ...input, motivoFechamento });

      expect(atendimentoRepository.findActiveBySessionAndRemoteJid).not.toHaveBeenCalled();
      expect(viviConversationRepository.findLatestBySessionAndPhone).not.toHaveBeenCalled();
      expect(viviConversationRepository.update).not.toHaveBeenCalled();
    },
  );

  it('motivoFechamento nulo (comportamento anterior a esta correcao): mantido inalterado - sinal tecnico ainda reabre', async () => {
    const { useCase, atendimentoRepository, viviConversationRepository, input } = setup();
    atendimentoRepository.findActiveBySessionAndRemoteJid.mockResolvedValue(null);
    const conversation = buildViviConversationRecord({ id: 'conversa-2', status: 'encaminhado_fila' });
    viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(conversation);
    viviConversationRepository.update.mockResolvedValue({ ...conversation, status: 'encerrada' });

    await useCase.execute({ ...input, motivoFechamento: null });

    expect(viviConversationRepository.update).toHaveBeenCalledWith('conversa-2', { status: 'encerrada' });
  });

  it('motivoFechamento com um valor fora da lista de negocio (ex: motivo antigo/livre pre-I8a): mantido inalterado - sinal tecnico ainda reabre', async () => {
    const { useCase, atendimentoRepository, viviConversationRepository, input } = setup();
    atendimentoRepository.findActiveBySessionAndRemoteJid.mockResolvedValue(null);
    const conversation = buildViviConversationRecord({ id: 'conversa-3', status: 'encaminhado_fila' });
    viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(conversation);
    viviConversationRepository.update.mockResolvedValue({ ...conversation, status: 'encerrada' });

    await useCase.execute({ ...input, motivoFechamento: 'texto livre antigo' });

    expect(viviConversationRepository.update).toHaveBeenCalledWith('conversa-3', { status: 'encerrada' });
  });
});
