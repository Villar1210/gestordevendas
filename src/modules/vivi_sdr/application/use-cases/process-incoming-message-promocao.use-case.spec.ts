// Promocao do Card de captura automatica (funil de remarketing) no ponto
// "transferir_para_corretor" (transferToBroker) - a parte mais delicada
// desta fatia por decisao explicita do usuario. Unitario: mocka TODAS as
// dependencias, foca so na DECISAO (promover vs criar um Card novo) e nos
// dados repassados para PromoverLeadMinimoUseCase/CreateQuickCardUseCase.
import { ProcessIncomingMessageUseCase } from './process-incoming-message.use-case';
import { IViviConversationRepository } from '../../domain/repositories/vivi-conversation-repository.interface';
import { IAiConversationService } from '../../../../shared/domain/services/ai-conversation.interface';
import { IWhatsAppMessageRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-message-repository.interface';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
import { SendWhatsAppMessageUseCase } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';
import { TransferToBrokerService } from '../services/transfer-to-broker.service';
import { GetOrCreateViviConfigUseCase } from './get-or-create-vivi-config.use-case';
import { RegistrarUsoViviUseCase } from './registrar-uso-vivi.use-case';
import { buildViviConversationRecord } from '../../../../../test/factories/vivi-conversation-record.factory';
import { buildViviConfigRecord } from '../../../../../test/factories/vivi-config-record.factory';
import { buildCardRecord } from '../../../../../test/factories/card-record.factory';

function setup() {
  const viviConversationRepository = {
    findLatestBySessionAndPhone: jest.fn(),
    findActiveBySessionAndPhone: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const aiConversationService = { generateReply: jest.fn(), confirmarExistenciaEmpreendimento: jest.fn() };
  const whatsAppMessageRepository = { findRecentBySessionAndNumber: jest.fn() };
  const pipelineRepository = { findAllByTenant: jest.fn() };
  const cardRepository = {
    existsByTenantAndPhoneWithOwner: jest.fn(),
    findRepiqueCardByTenantAndPhone: jest.fn(),
  };
  const stageRepository = { findAllByPipeline: jest.fn() };
  const sendWhatsAppMessageUseCase = { execute: jest.fn() };
  const createQuickCardUseCase = { execute: jest.fn() };
  const capturarLeadMinimoUseCase = { execute: jest.fn().mockResolvedValue(null) };
  const promoverLeadMinimoUseCase = { execute: jest.fn() };
  const createNoteUseCase = { execute: jest.fn() };
  const getOrCreateViviConfigUseCase = { execute: jest.fn() };
  const registrarUsoViviUseCase = { execute: jest.fn() };

  // TransferToBrokerService extraido de dentro de ProcessIncomingMessageUseCase
  // (I10 da auditoria) - instanciado aqui com os MESMOS mocks que os testes
  // abaixo inspecionam diretamente (promoverLeadMinimoUseCase/
  // createQuickCardUseCase/createNoteUseCase), so que agora passados por
  // dentro do service em vez de direto no construtor do use case principal.
  const transferToBrokerService = new TransferToBrokerService(
    pipelineRepository as unknown as IPipelineRepository,
    stageRepository as unknown as IStageRepository,
    createQuickCardUseCase as any,
    promoverLeadMinimoUseCase as any,
    createNoteUseCase as any,
  );

  const useCase = new ProcessIncomingMessageUseCase(
    viviConversationRepository as unknown as IViviConversationRepository,
    aiConversationService as unknown as IAiConversationService,
    whatsAppMessageRepository as unknown as IWhatsAppMessageRepository,
    cardRepository as unknown as ICardRepository,
    sendWhatsAppMessageUseCase as unknown as SendWhatsAppMessageUseCase,
    capturarLeadMinimoUseCase as any,
    createNoteUseCase as any,
    { execute: jest.fn() } as any, // GetOrCreateAtendimentoUseCase - nao usado neste caminho
    { execute: jest.fn() } as any, // ClassifyAndRouteAtendimentoUseCase - nao usado neste caminho
    {} as any, // AgendarVisitaUseCase - nao usado neste caminho (nao chama agendar_visita)
    getOrCreateViviConfigUseCase as unknown as GetOrCreateViviConfigUseCase,
    registrarUsoViviUseCase as unknown as RegistrarUsoViviUseCase,
    {} as any, // EnderecoBuscaToolResolverService - nao usado neste caminho
    transferToBrokerService,
  );

  viviConversationRepository.findLatestBySessionAndPhone.mockResolvedValue(null);
  cardRepository.existsByTenantAndPhoneWithOwner.mockResolvedValue(false);
  cardRepository.findRepiqueCardByTenantAndPhone.mockResolvedValue(null);
  const conversation = buildViviConversationRecord({ id: 'conversa-1' });
  viviConversationRepository.findActiveBySessionAndPhone.mockResolvedValue(null);
  viviConversationRepository.create.mockResolvedValue(conversation);
  viviConversationRepository.update.mockResolvedValue(conversation);
  getOrCreateViviConfigUseCase.execute.mockResolvedValue(buildViviConfigRecord());
  whatsAppMessageRepository.findRecentBySessionAndNumber.mockResolvedValue([
    { id: 'msg-1', direction: 'IN', body: 'Quero comprar um apartamento', remoteJid: '5511999999999@s.whatsapp.net' },
  ]);
  registrarUsoViviUseCase.execute.mockResolvedValue(undefined);
  pipelineRepository.findAllByTenant.mockResolvedValue([
    { id: 'pipeline-vendas', tenantId: 'tenant-1', name: 'Vendas Imoveis', createdAt: new Date() },
  ]);
  createNoteUseCase.execute.mockResolvedValue(undefined);
  sendWhatsAppMessageUseCase.execute.mockResolvedValue(undefined);

  const input = {
    tenantId: 'tenant-1',
    sessionId: 'session-1',
    phoneNumber: '5511999999999',
    messageBody: 'Quero comprar um apartamento',
  };

  return {
    useCase,
    input,
    viviConversationRepository,
    aiConversationService,
    createQuickCardUseCase,
    promoverLeadMinimoUseCase,
    createNoteUseCase,
  };
}

describe('ProcessIncomingMessageUseCase - promocao do Card de remarketing em transferir_para_corretor', () => {
  it('existe Card de captura automatica para o telefone: PROMOVE (nao chama CreateQuickCardUseCase)', async () => {
    const { useCase, input, aiConversationService, createQuickCardUseCase, promoverLeadMinimoUseCase, createNoteUseCase, viviConversationRepository } = setup();
    aiConversationService.generateReply.mockResolvedValue({
      replyText: 'Perfeito, um corretor vai te atender.',
      toolCalls: [{ name: 'transferir_para_corretor', input: { motivo: 'lead qualificado' } }],
    });
    const cardPromovido = buildCardRecord({ id: 'card-promovido' });
    promoverLeadMinimoUseCase.execute.mockResolvedValue(cardPromovido);

    await useCase.execute(input);

    expect(promoverLeadMinimoUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        phoneNumber: '5511999999999',
        targetPipelineId: 'pipeline-vendas',
        targetStageId: null,
        origem: 'roleta_online',
      }),
    );
    expect(createQuickCardUseCase.execute).not.toHaveBeenCalled();
    expect(createNoteUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'card-promovido' }),
    );
    expect(viviConversationRepository.update).toHaveBeenCalledWith(
      'conversa-1',
      expect.objectContaining({ cardId: 'card-promovido', status: 'qualificado_transferido' }),
    );
  });

  it('SEM Card de captura automatica para o telefone: cai no caminho antigo (cria um Card novo)', async () => {
    const { useCase, input, aiConversationService, createQuickCardUseCase, promoverLeadMinimoUseCase, createNoteUseCase } = setup();
    aiConversationService.generateReply.mockResolvedValue({
      replyText: 'Perfeito, um corretor vai te atender.',
      toolCalls: [{ name: 'transferir_para_corretor', input: { motivo: 'lead qualificado' } }],
    });
    promoverLeadMinimoUseCase.execute.mockResolvedValue(null);
    createQuickCardUseCase.execute.mockResolvedValue(buildCardRecord({ id: 'card-novo' }));

    await useCase.execute(input);

    expect(createQuickCardUseCase.execute).toHaveBeenCalledTimes(1);
    expect(createNoteUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ cardId: 'card-novo' }));
  });
});
