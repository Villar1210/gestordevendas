// Construtoras (Fatia B): o bloco "Sobre a construtora/incorporadora" do
// prompt da VIVI usa o texto da construtora do EMPREENDIMENTO da conversa;
// sem empreendimento, sem construtora ou construtora sem texto, cai no
// texto padrao da Configuracao da VIVI. Unitario com tudo mockado: so
// inspeciona o systemPrompt entregue a IA (a IA falha de proposito logo em
// seguida, caminho ja coberto em process-incoming-message.use-case.spec.ts).
import { ProcessIncomingMessageUseCase } from './process-incoming-message.use-case';
import { ViviAtendimentoEscalationService } from '../services/vivi-atendimento-escalation.service';
import { ViviMessageGuardsService } from '../services/vivi-message-guards.service';
import { buildViviConversationRecord } from '../../../../../test/factories/vivi-conversation-record.factory';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';
import { ConstrutoraDoEmpreendimento } from '../../domain/repositories/construtora-do-empreendimento-repository.interface';

// Config minima da VIVI (so os campos que o prompt le). Nao usa
// test/factories/vivi-config-record.factory.ts: aquela factory esta
// desatualizada (sem diasParaRotting - falha pre-existente, ver CLAUDE.md).
const CONFIG_VIVI = {
  precoMinimo: 200000,
  limiteSemPerfil: 2000,
  limiteFaixa1: 2850,
  limiteFaixa2: 4700,
  limiteFaixa3: 8600,
  limiteFaixa4: 12000,
  faixa1SubsidioMax: null,
  faixa1JurosMin: null,
  faixa1JurosMax: null,
  faixa1TetoFinanciamento: null,
  faixa2SubsidioMax: null,
  faixa2JurosMin: null,
  faixa2JurosMax: null,
  faixa2TetoFinanciamento: null,
  faixa3SubsidioMax: null,
  faixa3JurosMin: null,
  faixa3JurosMax: null,
  faixa3TetoFinanciamento: null,
  faixa4SubsidioMax: null,
  faixa4JurosMin: null,
  faixa4JurosMax: null,
  faixa4TetoFinanciamento: null,
};

const PADRAO_SOBRE = 'Texto padrao da empresa (Direcional).';
const PADRAO_DIFERENCIAIS = 'Diferenciais padrao.';

function setup(opcoes: {
  empreendimentoId: string | null;
  construtora?: ConstrutoraDoEmpreendimento | null;
  falhaNaLeitura?: boolean;
}) {
  const conversation = buildViviConversationRecord({ id: 'conversa-1', empreendimentoId: opcoes.empreendimentoId });
  const viviConversationRepository = {
    findLatestBySessionAndPhone: jest.fn().mockResolvedValue(null),
    findActiveBySessionAndPhone: jest.fn().mockResolvedValue(conversation),
    create: jest.fn().mockResolvedValue(conversation),
    update: jest.fn().mockResolvedValue(conversation),
  };
  const aiConversationService = {
    generateReply: jest.fn().mockRejectedValue(new Error('IA fora (teste)')),
    confirmarExistenciaEmpreendimento: jest.fn(),
  };
  const whatsAppMessageRepository = {
    findRecentBySessionAndNumber: jest
      .fn()
      .mockResolvedValue([{ id: 'm-1', direction: 'IN', body: 'Oi', remoteJid: '5511999999999@s.whatsapp.net' }]),
  };
  const cardRepository = {
    existsByTenantAndPhoneWithOwner: jest.fn().mockResolvedValue(false),
    findRepiqueCardByTenantAndPhone: jest.fn().mockResolvedValue(null),
  };
  const sendWhatsAppMessageUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
  const getOrCreateAtendimentoUseCase = {
    execute: jest.fn().mockResolvedValue(buildAtendimentoRecord({ id: 'at-1', tenantId: 'tenant-1' })),
  };
  const classifyAndRouteAtendimentoUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
  const construtoraRepo = {
    buscarPorEmpreendimento: opcoes.falhaNaLeitura
      ? jest.fn().mockRejectedValue(new Error('banco fora'))
      : jest.fn().mockResolvedValue(opcoes.construtora ?? null),
  };

  const useCase = new ProcessIncomingMessageUseCase(
    viviConversationRepository as never,
    aiConversationService as never,
    whatsAppMessageRepository as never,
    sendWhatsAppMessageUseCase as never,
    { execute: jest.fn().mockResolvedValue(null) } as never,
    {} as never,
    {} as never,
    {
      execute: jest
        .fn()
        .mockResolvedValue({ ...CONFIG_VIVI, sobreConstrutora: PADRAO_SOBRE, diferenciaisConstrutora: PADRAO_DIFERENCIAIS }),
    } as never,
    { execute: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    {} as never,
    new ViviAtendimentoEscalationService(
      getOrCreateAtendimentoUseCase as never,
      classifyAndRouteAtendimentoUseCase as never,
      sendWhatsAppMessageUseCase as never,
      viviConversationRepository as never,
    ),
    new ViviMessageGuardsService(cardRepository as never, sendWhatsAppMessageUseCase as never),
    construtoraRepo,
  );

  async function promptEnviado(): Promise<string> {
    await useCase.execute({ tenantId: 'tenant-1', sessionId: 'session-1', phoneNumber: '5511999999999', messageBody: 'Oi' });
    expect(aiConversationService.generateReply).toHaveBeenCalledTimes(1);
    return aiConversationService.generateReply.mock.calls[0][0].systemPrompt as string;
  }

  return { promptEnviado, construtoraRepo };
}

describe('ProcessIncomingMessageUseCase - texto da construtora no prompt (Construtoras, Fatia B)', () => {
  it('conversa com empreendimento cuja construtora tem texto: usa o texto DELA, com o nome, sem o padrao', async () => {
    const { promptEnviado, construtoraRepo } = setup({
      empreendimentoId: 'emp-novolar',
      construtora: { nome: 'Novolar', sobre: 'A Novolar constroi na Freguesia.', diferenciais: 'Entrega no prazo.' },
    });
    const prompt = await promptEnviado();
    expect(construtoraRepo.buscarPorEmpreendimento).toHaveBeenCalledWith('tenant-1', 'emp-novolar');
    expect(prompt).toContain('## Sobre a construtora/incorporadora (Novolar)');
    expect(prompt).toContain('A Novolar constroi na Freguesia.');
    expect(prompt).toContain('Entrega no prazo.');
    expect(prompt).not.toContain(PADRAO_SOBRE);
    expect(prompt).not.toContain(PADRAO_DIFERENCIAIS);
  });

  it('construtora so com "sobre": nao mistura os diferenciais do texto padrao', async () => {
    const { promptEnviado } = setup({
      empreendimentoId: 'emp-novolar',
      construtora: { nome: 'Novolar', sobre: 'So o sobre da Novolar.', diferenciais: '   ' },
    });
    const prompt = await promptEnviado();
    expect(prompt).toContain('So o sobre da Novolar.');
    expect(prompt).not.toContain(PADRAO_DIFERENCIAIS);
  });

  it('conversa sem empreendimento: texto padrao da Configuracao da VIVI, sem consultar construtora', async () => {
    const { promptEnviado, construtoraRepo } = setup({ empreendimentoId: null });
    const prompt = await promptEnviado();
    expect(construtoraRepo.buscarPorEmpreendimento).not.toHaveBeenCalled();
    expect(prompt).toContain('## Sobre a construtora/incorporadora\n');
    expect(prompt).toContain(PADRAO_SOBRE);
    expect(prompt).toContain(PADRAO_DIFERENCIAIS);
  });

  it('empreendimento sem construtora vinculada: texto padrao', async () => {
    const { promptEnviado } = setup({ empreendimentoId: 'emp-x', construtora: null });
    const prompt = await promptEnviado();
    expect(prompt).toContain(PADRAO_SOBRE);
  });

  it('construtora sem nenhum texto: texto padrao (sem o nome dela no titulo)', async () => {
    const { promptEnviado } = setup({
      empreendimentoId: 'emp-x',
      construtora: { nome: 'Riva', sobre: null, diferenciais: '' },
    });
    const prompt = await promptEnviado();
    expect(prompt).toContain(PADRAO_SOBRE);
    expect(prompt).not.toContain('(Riva)');
  });

  it('falha ao ler a construtora: nao derruba a resposta, cai no texto padrao', async () => {
    const { promptEnviado } = setup({ empreendimentoId: 'emp-x', falhaNaLeitura: true });
    const prompt = await promptEnviado();
    expect(prompt).toContain(PADRAO_SOBRE);
  });
});
