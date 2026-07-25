// Fluxo completo da captura automatica de lead minimo (funil de
// remarketing): primeira mensagem sem nenhum Card existente -> Card minimo
// criado no pipeline "Leads Nao Qualificados"; mensagens seguintes do MESMO
// telefone NAO duplicam a captura; qualificacao completa depois PROMOVE
// (muta) o MESMO Card para o funil de vendas, sem criar um segundo.
//
// Integracao (banco real, crm_core_db_test - ver jest.setup.ts): o que
// importa aqui e a PERSISTENCIA/CONSULTA real (existsByTenantAndPhone,
// findByTenantPhoneAndPipeline, moveToPipelineAndStage) - um repositorio
// mockado nao provaria a ausencia de duplicacao no banco. Usa os
// repositorios Prisma reais + os use cases reais (CapturarLeadMinimoUseCase,
// PromoverLeadMinimoUseCase, GetOrCreateRemarketingPipelineUseCase,
// CreateQuickCardUseCase), sem mock nenhum - so o EventEmitter2 e uma
// instancia real sem listeners (inofensivo, ninguem escuta 'card.sem_dono.criado' aqui).
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaPipelineRepository } from '../../infra/database/prisma-pipeline.repository';
import { PrismaStageRepository } from '../../infra/database/prisma-stage.repository';
import { PrismaCardRepository } from '../../infra/database/prisma-card.repository';
import { GetOrCreateRemarketingPipelineUseCase } from './get-or-create-remarketing-pipeline.use-case';
import { CreateQuickCardUseCase } from './create-quick-card.use-case';
import { CapturarLeadMinimoUseCase } from './capturar-lead-minimo.use-case';
import { PromoverLeadMinimoUseCase } from './promover-lead-minimo.use-case';
import { REMARKETING_PIPELINE_NOME, REMARKETING_STAGE_NOME } from '../../domain/services/remarketing-pipeline';

describe('Captura automatica de lead minimo + promocao para o funil de vendas (integracao)', () => {
  let prisma: PrismaService;
  let pipelineRepository: PrismaPipelineRepository;
  let stageRepository: PrismaStageRepository;
  let cardRepository: PrismaCardRepository;
  let capturarLeadMinimoUseCase: CapturarLeadMinimoUseCase;
  let promoverLeadMinimoUseCase: PromoverLeadMinimoUseCase;
  let tenantId: string;
  let vendasPipelineId: string;
  const phoneNumber = '5511988887777';

  beforeAll(async () => {
    prisma = new PrismaService();
    pipelineRepository = new PrismaPipelineRepository(prisma);
    stageRepository = new PrismaStageRepository(prisma);
    cardRepository = new PrismaCardRepository(prisma);
    const eventEmitter = new EventEmitter2();
    const getOrCreateRemarketingPipelineUseCase = new GetOrCreateRemarketingPipelineUseCase(
      pipelineRepository,
      stageRepository,
    );
    const createQuickCardUseCase = new CreateQuickCardUseCase(pipelineRepository, cardRepository, eventEmitter);
    capturarLeadMinimoUseCase = new CapturarLeadMinimoUseCase(
      cardRepository,
      getOrCreateRemarketingPipelineUseCase,
      createQuickCardUseCase,
    );
    promoverLeadMinimoUseCase = new PromoverLeadMinimoUseCase(pipelineRepository, cardRepository, eventEmitter);

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Captura Lead Minimo' } });
    tenantId = tenant.id;
    const vendasPipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Vendas Imoveis' } });
    vendasPipelineId = vendasPipeline.id;
  });

  afterAll(async () => {
    await prisma.card.deleteMany({ where: { tenantId } });
    await prisma.stage.deleteMany({ where: { tenantId } });
    await prisma.pipeline.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  it('PASSO 1: primeira mensagem sem nenhum Card existente cria o Card minimo no pipeline de remarketing', async () => {
    const card = await capturarLeadMinimoUseCase.execute({
      tenantId,
      phoneNumber,
      pushName: 'Daniel',
    });

    expect(card).not.toBeNull();
    expect(card?.title).toBe('Daniel');
    expect(card?.origem).toBe('captura_auto_vivi');

    const pipeline = await prisma.pipeline.findFirst({ where: { tenantId, name: REMARKETING_PIPELINE_NOME } });
    expect(pipeline).not.toBeNull();
    expect(card?.pipelineId).toBe(pipeline!.id);

    const stage = await prisma.stage.findFirst({ where: { pipelineId: pipeline!.id, name: REMARKETING_STAGE_NOME } });
    expect(card?.stageId).toBe(stage!.id);
  });

  it('PASSO 2: uma segunda mensagem do MESMO telefone NAO duplica a captura', async () => {
    const card = await capturarLeadMinimoUseCase.execute({
      tenantId,
      phoneNumber,
      pushName: 'Daniel',
    });

    expect(card).toBeNull();

    const total = await prisma.card.count({ where: { tenantId, phone: phoneNumber } });
    expect(total).toBe(1);
  });

  it('PASSO 3: qualificacao completa PROMOVE (muta) o MESMO Card para o funil de vendas, sem criar um segundo', async () => {
    const cardAntes = await prisma.card.findFirst({ where: { tenantId, phone: phoneNumber } });
    expect(cardAntes).not.toBeNull();

    const promovido = await promoverLeadMinimoUseCase.execute({
      tenantId,
      phoneNumber,
      targetPipelineId: vendasPipelineId,
      targetStageId: null,
      position: 0,
      title: 'Daniel Villar',
      description: 'Lead qualificado: apartamento, R$ 300.000, Zona Sul',
      origem: 'roleta_online',
    });

    expect(promovido).not.toBeNull();
    // MESMO id do card capturado no Passo 1 - a promocao MUTA, nunca cria.
    expect(promovido?.id).toBe(cardAntes!.id);
    expect(promovido?.pipelineId).toBe(vendasPipelineId);
    expect(promovido?.stageId).toBeNull();
    expect(promovido?.title).toBe('Daniel Villar');
    expect(promovido?.description).toBe('Lead qualificado: apartamento, R$ 300.000, Zona Sul');
    expect(promovido?.origem).toBe('roleta_online');

    const total = await prisma.card.count({ where: { tenantId, phone: phoneNumber } });
    expect(total).toBe(1);
  });

  it('PASSO 4: uma mensagem seguinte do mesmo telefone (ja promovido) continua NAO recapturando', async () => {
    const card = await capturarLeadMinimoUseCase.execute({
      tenantId,
      phoneNumber,
      pushName: 'Daniel',
    });

    expect(card).toBeNull();

    const total = await prisma.card.count({ where: { tenantId, phone: phoneNumber } });
    expect(total).toBe(1);
  });

  it('telefone SEM nenhum Card de remarketing (qualificou direto): promover retorna null, chamador cria um Card novo normalmente', async () => {
    const outroTelefone = '5511977776666';

    const promovido = await promoverLeadMinimoUseCase.execute({
      tenantId,
      phoneNumber: outroTelefone,
      targetPipelineId: vendasPipelineId,
      targetStageId: null,
      position: 0,
      title: 'Lead direto',
    });

    expect(promovido).toBeNull();
  });
});
