// Auditoria de seguranca/integridade (achado C2, 27/07/2026): mensagens
// concorrentes do mesmo lead (ex: "oi" seguido segundos depois de "confirmando
// a visita amanha 15h") podem disparar processamento paralelo do fluxo
// "buscar-ou-criar" da ViviConversation (findOrCreateConversation, metodo
// PRIVADO de ProcessIncomingMessageUseCase) - sem protecao de banco, cada
// execucao concorrente criava sua propria ViviConversation duplicada.
// Integracao (banco real, crm_core_db_test - ver jest.setup.ts) porque o que
// importa aqui e a CONCORRENCIA REAL contra o indice unico parcial
// "vivi_conversations_active_session_phone_key" (ver schema.prisma) - um
// repositorio mockado nao provaria que a corrida e resolvida no banco de
// verdade.
//
// Como findOrCreateConversation e PRIVADO (decisao deliberada: nao expor so
// para teste, ver CLAUDE.md regra 5 sobre nao mudar mais do que o
// necessario), este teste exercita o metodo PUBLICO execute() de ponta a
// ponta, usando o PrismaViviConversationRepository REAL (o unico
// dependencia relevante para este achado) e mocks simples (jest.fn(), sem
// nenhuma chamada real a rede/IA) para as demais dependencias do use
// case - mesmo padrao de construcao manual ja usado em
// process-incoming-message.use-case.spec.ts (unitario), so trocando o
// repositorio da ViviConversation por um real.
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaViviConversationRepository } from '../../infra/database/prisma-vivi-conversation.repository';
import { ProcessIncomingMessageUseCase } from './process-incoming-message.use-case';
import { buildViviConfigRecord } from '../../../../../test/factories/vivi-config-record.factory';

describe('ProcessIncomingMessageUseCase - corrida entre mensagens concorrentes na ViviConversation (integracao)', () => {
  let prisma: PrismaService;
  let viviConversationRepository: PrismaViviConversationRepository;
  let useCase: ProcessIncomingMessageUseCase;
  let tenantId: string;
  let sessionId: string;

  const aiConversationService = { generateReply: jest.fn(), confirmarExistenciaEmpreendimento: jest.fn() };
  const whatsAppMessageRepository = { findRecentBySessionAndNumber: jest.fn() };
  const cardRepository = {
    existsByTenantAndPhoneWithOwner: jest.fn(),
    findRepiqueCardByTenantAndPhone: jest.fn(),
  };
  const sendWhatsAppMessageUseCase = { execute: jest.fn() };
  const capturarLeadMinimoUseCase = { execute: jest.fn() };
  const getOrCreateAtendimentoUseCase = { execute: jest.fn() };
  const classifyAndRouteAtendimentoUseCase = { execute: jest.fn() };
  const getOrCreateViviConfigUseCase = { execute: jest.fn() };
  const registrarUsoViviUseCase = { execute: jest.fn() };

  beforeAll(async () => {
    prisma = new PrismaService();
    viviConversationRepository = new PrismaViviConversationRepository(prisma);

    useCase = new ProcessIncomingMessageUseCase(
      viviConversationRepository,
      aiConversationService as any,
      whatsAppMessageRepository as any,
      cardRepository as any,
      sendWhatsAppMessageUseCase as any,
      capturarLeadMinimoUseCase as any,
      {} as any, // CreateNoteUseCase - nao usado no caminho de resposta simples sem tool
      getOrCreateAtendimentoUseCase as any,
      classifyAndRouteAtendimentoUseCase as any,
      {} as any, // AgendarVisitaUseCase - nao usado no caminho de resposta simples sem tool
      getOrCreateViviConfigUseCase as any,
      registrarUsoViviUseCase as any,
      {} as any, // EnderecoBuscaToolResolverService - nao usado no caminho de resposta simples sem tool
      {} as any, // TransferToBrokerService - nao usado no caminho de resposta simples sem tool
    );

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Corrida ViviConversation' } });
    tenantId = tenant.id;
    const session = await prisma.whatsAppSession.create({
      data: { tenantId, label: 'WhatsApp Teste Corrida', status: 'CONNECTED', phoneNumber: '5511966111740' },
    });
    sessionId = session.id;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cardRepository.existsByTenantAndPhoneWithOwner.mockResolvedValue(false);
    cardRepository.findRepiqueCardByTenantAndPhone.mockResolvedValue(null);
    capturarLeadMinimoUseCase.execute.mockResolvedValue(null);
    whatsAppMessageRepository.findRecentBySessionAndNumber.mockResolvedValue([]);
    getOrCreateViviConfigUseCase.execute.mockResolvedValue(buildViviConfigRecord({ tenantId }));
    registrarUsoViviUseCase.execute.mockResolvedValue(undefined);
    sendWhatsAppMessageUseCase.execute.mockResolvedValue(undefined);
    // Resposta simples da IA, sem nenhuma tool call - nao toca
    // Card/Atendimento, exercita SOMENTE o achado desta fork (ViviConversation).
    aiConversationService.generateReply.mockResolvedValue({
      replyText: 'Ola! Como posso te ajudar a encontrar um imovel?',
      toolCalls: [],
    });
  });

  afterAll(async () => {
    await prisma.viviConversation.deleteMany({ where: { tenantId } });
    await prisma.whatsAppSession.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  it('CENARIO OBRIGATORIO: duas mensagens do mesmo lead chegando concorrentemente (Promise.all, nao sequencial) resultam em UMA UNICA ViviConversation, e as duas mensagens sao processadas nela (2 chamadas a IA, nenhum erro)', async () => {
    const phoneNumber = '5511988887777';

    // Forca a colisao real no banco em vez de depender de sorte de timing
    // do SO/rede: em testes anteriores (Atendimento, Card), o timing natural
    // do Promise.all bastou para colidir no indice unico parcial - mas para
    // ViviConversation a janela entre o find e o create() e mais estreita
    // (menos chamadas reais ao banco no meio do caminho), e rodadas
    // repetidas confirmaram que o timing natural nem sempre colide de
    // verdade. Uma "barreira" garante que as DUAS chamadas concorrentes so
    // disparam o INSERT depois que AMBAS ja chegaram ali - reproduzindo de
    // forma DETERMINISTICA o pior caso (as duas literalmente inserindo ao
    // mesmo tempo), sem alterar nenhum comportamento do codigo de producao.
    let liberarPrimeira: () => void;
    const segundaChegou = new Promise<void>((resolve) => {
      liberarPrimeira = resolve;
    });
    let chamadas = 0;
    const createOriginal = viviConversationRepository.create.bind(viviConversationRepository);
    jest.spyOn(viviConversationRepository, 'create').mockImplementation(async (input) => {
      chamadas += 1;
      if (chamadas === 1) {
        await segundaChegou;
      } else {
        liberarPrimeira();
      }
      return createOriginal(input);
    });

    // Simula "oi" e "confirmando a visita amanha 15h" chegando quase juntas -
    // as duas disparam execute() ANTES de qualquer uma terminar.
    await Promise.all([
      useCase.execute({ tenantId, sessionId, phoneNumber, messageBody: 'Oi' }),
      useCase.execute({ tenantId, sessionId, phoneNumber, messageBody: 'Confirmando a visita amanha 15h' }),
    ]);

    // As duas mensagens foram processadas (nenhuma perdida/descartada por
    // erro) - a IA foi chamada 2 vezes.
    expect(aiConversationService.generateReply).toHaveBeenCalledTimes(2);
    expect(sendWhatsAppMessageUseCase.execute).toHaveBeenCalledTimes(2);

    const total = await prisma.viviConversation.count({
      where: { tenantId, whatsappSessionId: sessionId, phoneNumber, status: 'em_andamento' },
    });
    expect(total).toBe(1);
  });

  it('caminho normal (sem concorrencia): mensagens sequenciais do mesmo lead reaproveitam a mesma ViviConversation em_andamento, sem regressao', async () => {
    const phoneNumber = '5511977776666';

    await useCase.execute({ tenantId, sessionId, phoneNumber, messageBody: 'Oi' });
    await useCase.execute({ tenantId, sessionId, phoneNumber, messageBody: 'Quero um apartamento de 2 quartos' });

    expect(aiConversationService.generateReply).toHaveBeenCalledTimes(2);

    const total = await prisma.viviConversation.count({
      where: { tenantId, whatsappSessionId: sessionId, phoneNumber, status: 'em_andamento' },
    });
    expect(total).toBe(1);
  });
});
