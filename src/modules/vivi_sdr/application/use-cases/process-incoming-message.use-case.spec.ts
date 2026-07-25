// Resiliencia a falha definitiva da chamada a Anthropic (commit bea2007,
// Critico #1 da auditoria de producao). Unitario: o comportamento a
// proteger e puro branching de negocio (nunca deixar o lead sem resposta +
// roteamento para fila prioritaria + status da conversa) - nao depende de
// banco nem, principalmente, de uma chamada real a API da Anthropic (que
// jamais deveria rodar num teste automatizado). Mocka TODAS as
// dependencias e verifica so o caminho de falha (generateReply rejeitando).
import { ProcessIncomingMessageUseCase } from './process-incoming-message.use-case';
import { IViviConversationRepository } from '../../domain/repositories/vivi-conversation-repository.interface';
import { IAiConversationService } from '../../../../shared/domain/services/ai-conversation.interface';
import { IWhatsAppMessageRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-message-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { SendWhatsAppMessageUseCase } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';
import { GetOrCreateAtendimentoUseCase } from '../../../atendimento/application/use-cases/get-or-create-atendimento.use-case';
import { ClassifyAndRouteAtendimentoUseCase } from '../../../atendimento/application/use-cases/classify-and-route-atendimento.use-case';
import { GetOrCreateViviConfigUseCase } from './get-or-create-vivi-config.use-case';
import { RegistrarUsoViviUseCase } from './registrar-uso-vivi.use-case';
import { FILA_ATENDIMENTO_PRIORITARIO_NOME } from '../../../atendimento/domain/services/fila-categorias';
import { buildViviConversationRecord } from '../../../../../test/factories/vivi-conversation-record.factory';
import { buildViviConfigRecord } from '../../../../../test/factories/vivi-config-record.factory';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';

function setup() {
  const viviConversationRepository = {
    findLatestBySessionAndPhone: jest.fn(),
    findActiveBySessionAndPhone: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const aiConversationService = {
    generateReply: jest.fn(),
    confirmarExistenciaEmpreendimento: jest.fn(),
  };
  const whatsAppMessageRepository = {
    findRecentBySessionAndNumber: jest.fn(),
  };
  const cardRepository = {
    existsByTenantAndPhoneWithOwner: jest.fn(),
    findRepiqueCardByTenantAndPhone: jest.fn(),
  };
  const sendWhatsAppMessageUseCase = { execute: jest.fn() };
  const getOrCreateAtendimentoUseCase = { execute: jest.fn() };
  const classifyAndRouteAtendimentoUseCase = { execute: jest.fn() };
  const getOrCreateViviConfigUseCase = { execute: jest.fn() };
  const registrarUsoViviUseCase = { execute: jest.fn() };

  const useCase = new ProcessIncomingMessageUseCase(
    viviConversationRepository as unknown as IViviConversationRepository,
    aiConversationService as unknown as IAiConversationService,
    whatsAppMessageRepository as unknown as IWhatsAppMessageRepository,
    {} as any, // IPipelineRepository - nao usado no caminho de falha da IA
    cardRepository as unknown as ICardRepository,
    {} as any, // IStageRepository - nao usado no caminho de falha da IA
    sendWhatsAppMessageUseCase as unknown as SendWhatsAppMessageUseCase,
    {} as any, // CreateQuickCardUseCase - nao usado no caminho de falha da IA
    {} as any, // CreateNoteUseCase - nao usado no caminho de falha da IA
    getOrCreateAtendimentoUseCase as unknown as GetOrCreateAtendimentoUseCase,
    classifyAndRouteAtendimentoUseCase as unknown as ClassifyAndRouteAtendimentoUseCase,
    {} as any, // AgendarVisitaUseCase - nao usado no caminho de falha da IA
    getOrCreateViviConfigUseCase as unknown as GetOrCreateViviConfigUseCase,
    registrarUsoViviUseCase as unknown as RegistrarUsoViviUseCase,
    {} as any, // BuscarEmpreendimentoPorEnderecoUseCase - nao usado no caminho de falha da IA
    {} as any, // IEnderecoBuscaLogRepository - nao usado no caminho de falha da IA
  );

  // Estado "feliz" ate a chamada a IA: nenhuma das 2 guardas de reabertura
  // de dialogo bloqueia, conversa nova e criada, config existe, sem
  // historico e sem card de Repique.
  viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(null);
  cardRepository.existsByTenantAndPhoneWithOwner.mockResolvedValue(false);
  cardRepository.findRepiqueCardByTenantAndPhone.mockResolvedValue(null);
  const conversation = buildViviConversationRecord({ id: 'conversa-1' });
  viviConversationRepository.findActiveBySessionAndPhone.mockResolvedValue(null);
  viviConversationRepository.create.mockResolvedValue(conversation);
  getOrCreateViviConfigUseCase.execute.mockResolvedValue(buildViviConfigRecord());
  whatsAppMessageRepository.findRecentBySessionAndNumber.mockResolvedValue([
    {
      id: 'msg-1',
      direction: 'IN',
      body: 'Oi, procuro um apartamento',
      remoteJid: '5511999999999@s.whatsapp.net',
    },
  ]);
  registrarUsoViviUseCase.execute.mockResolvedValue(undefined);

  const input = {
    tenantId: 'tenant-1',
    sessionId: 'session-1',
    phoneNumber: '5511999999999',
    messageBody: 'Oi, procuro um apartamento',
  };

  return {
    useCase,
    input,
    conversation,
    viviConversationRepository,
    aiConversationService,
    sendWhatsAppMessageUseCase,
    getOrCreateAtendimentoUseCase,
    classifyAndRouteAtendimentoUseCase,
  };
}

describe('ProcessIncomingMessageUseCase - resiliencia a falha da IA (handleAiFailure)', () => {
  it('em falha definitiva da IA: envia fallback, roteia para fila prioritaria e marca a conversa como encaminhado_fila', async () => {
    const {
      useCase,
      input,
      conversation,
      viviConversationRepository,
      aiConversationService,
      sendWhatsAppMessageUseCase,
      getOrCreateAtendimentoUseCase,
      classifyAndRouteAtendimentoUseCase,
    } = setup();

    aiConversationService.generateReply.mockRejectedValue(new Error('Anthropic indisponivel apos retries'));
    getOrCreateAtendimentoUseCase.execute.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', tenantId: 'tenant-1' }),
    );
    classifyAndRouteAtendimentoUseCase.execute.mockResolvedValue(undefined);
    sendWhatsAppMessageUseCase.execute.mockResolvedValue(undefined);
    viviConversationRepository.update.mockResolvedValue(conversation);

    await useCase.execute(input);

    // 1. Nunca deixa o lead sem NENHUMA resposta.
    expect(sendWhatsAppMessageUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        to: '5511999999999@s.whatsapp.net',
        body: expect.stringMatching(/instabilidade/i),
      }),
    );

    // 2. Roteia para a fila dedicada, sempre urgente.
    expect(getOrCreateAtendimentoUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        phoneNumber: '5511999999999',
      }),
    );
    expect(classifyAndRouteAtendimentoUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        filaNome: FILA_ATENDIMENTO_PRIORITARIO_NOME,
        urgente: true,
        resumo: expect.stringContaining('Anthropic indisponivel apos retries'),
      }),
    );

    // 3. Marca a conversa para a VIVI nao reabrir o dialogo neste numero.
    expect(viviConversationRepository.update).toHaveBeenCalledWith('conversa-1', {
      status: 'encaminhado_fila',
    });
  });

  it('mesmo se o envio do fallback ao lead falhar, ainda assim roteia para a fila e marca a conversa', async () => {
    const {
      useCase,
      input,
      viviConversationRepository,
      aiConversationService,
      sendWhatsAppMessageUseCase,
      getOrCreateAtendimentoUseCase,
      classifyAndRouteAtendimentoUseCase,
    } = setup();

    aiConversationService.generateReply.mockRejectedValue(new Error('timeout definitivo'));
    sendWhatsAppMessageUseCase.execute.mockRejectedValue(new Error('sessao do WhatsApp caiu'));
    getOrCreateAtendimentoUseCase.execute.mockResolvedValue(buildAtendimentoRecord({ id: 'atendimento-2' }));
    classifyAndRouteAtendimentoUseCase.execute.mockResolvedValue(undefined);
    viviConversationRepository.update.mockResolvedValue(undefined);

    await expect(useCase.execute(input)).resolves.not.toThrow();

    expect(classifyAndRouteAtendimentoUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ filaNome: FILA_ATENDIMENTO_PRIORITARIO_NOME, urgente: true }),
    );
    expect(viviConversationRepository.update).toHaveBeenCalledWith('conversa-1', {
      status: 'encaminhado_fila',
    });
  });

  it('quando a IA responde normalmente, NAO aciona o fallback nem a fila prioritaria', async () => {
    const {
      useCase,
      input,
      aiConversationService,
      sendWhatsAppMessageUseCase,
      getOrCreateAtendimentoUseCase,
      classifyAndRouteAtendimentoUseCase,
    } = setup();

    aiConversationService.generateReply.mockResolvedValue({
      replyText: 'Claro, me conta mais sobre o que voce procura!',
      toolCalls: [],
    });

    await useCase.execute(input);

    expect(getOrCreateAtendimentoUseCase.execute).not.toHaveBeenCalled();
    expect(classifyAndRouteAtendimentoUseCase.execute).not.toHaveBeenCalled();
    // sendWhatsAppMessageUseCase e usado tambem para a resposta normal da
    // VIVI, entao aqui so confirmamos que NAO foi chamado com a mensagem de
    // fallback tecnico.
    const chamadasComFallback = sendWhatsAppMessageUseCase.execute.mock.calls.filter(([arg]: any[]) =>
      /instabilidade/i.test(arg?.body ?? ''),
    );
    expect(chamadasComFallback).toHaveLength(0);
  });
});
