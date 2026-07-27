// Auditoria de seguranca/integridade (achado C2, 27/07/2026): mensagens
// concorrentes do mesmo lead (ex: "oi" seguido segundos depois de "confirmando
// a visita amanha 15h") podem disparar processamento paralelo da captura
// automatica de lead minimo - sem protecao de banco, cada execucao
// concorrente criava seu proprio Card duplicado no pipeline de remarketing.
// Integracao (banco real, crm_core_db_test - ver jest.setup.ts) porque o que
// importa aqui e a CONCORRENCIA REAL contra o indice unico parcial
// "cards_captura_auto_vivi_tenant_phone_key" (ver schema.prisma) - um
// repositorio mockado nao provaria que a corrida e resolvida no banco de
// verdade. Complementa (mesmo padrao de setup de)
// captura-e-promocao-lead-minimo.integration.spec.ts, que ja cobre o fluxo
// sequencial normal - este arquivo cobre exclusivamente o cenario
// concorrente.
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaPipelineRepository } from '../../infra/database/prisma-pipeline.repository';
import { PrismaStageRepository } from '../../infra/database/prisma-stage.repository';
import { PrismaCardRepository } from '../../infra/database/prisma-card.repository';
import { GetOrCreateRemarketingPipelineUseCase } from './get-or-create-remarketing-pipeline.use-case';
import { CreateQuickCardUseCase } from './create-quick-card.use-case';
import { CapturarLeadMinimoUseCase } from './capturar-lead-minimo.use-case';

describe('CapturarLeadMinimoUseCase - corrida entre mensagens concorrentes (integracao)', () => {
  let prisma: PrismaService;
  let cardRepository: PrismaCardRepository;
  let capturarLeadMinimoUseCase: CapturarLeadMinimoUseCase;
  let tenantId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    const pipelineRepository = new PrismaPipelineRepository(prisma);
    const stageRepository = new PrismaStageRepository(prisma);
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

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Corrida Lead Minimo' } });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.card.deleteMany({ where: { tenantId } });
    await prisma.stage.deleteMany({ where: { tenantId } });
    await prisma.pipeline.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  it('CENARIO OBRIGATORIO: duas mensagens do mesmo lead chegando concorrentemente (Promise.all, nao sequencial) resultam em UM UNICO Card de captura automatica, nunca em erro ou perda', async () => {
    const phoneNumber = '5511988887777';

    // Simula "oi" e "confirmando a visita amanha 15h" chegando quase juntas -
    // as duas disparam CapturarLeadMinimoUseCase.execute() ANTES de qualquer
    // uma terminar (Promise.all, nao await sequencial). Exatamente UMA das
    // duas deve retornar o Card criado (a outra retorna null, mesmo
    // contrato ja existente de "ja rastreado, nao recaptura") - OU as duas
    // podem retornar o mesmo Card, dependendo de qual delas ganha a corrida
    // vs. qual roda o existsByTenantAndPhone depois do outro ja ter commitado
    // - o que importa e nunca haver 2 Cards nem erro nao tratado.
    const [resultado1, resultado2] = await Promise.all([
      capturarLeadMinimoUseCase.execute({ tenantId, phoneNumber, pushName: 'Daniel' }),
      capturarLeadMinimoUseCase.execute({ tenantId, phoneNumber, pushName: 'Daniel' }),
    ]);

    const cardsCriados = [resultado1, resultado2].filter((c) => c !== null);
    expect(cardsCriados.length).toBeGreaterThanOrEqual(1);
    // Se as duas retornaram um Card (nenhuma bateu no early-return
    // existsByTenantAndPhone antes da outra committar), tem que ser o MESMO id.
    if (resultado1 && resultado2) {
      expect(resultado1.id).toBe(resultado2.id);
    }

    const total = await prisma.card.count({ where: { tenantId, phone: phoneNumber, origem: 'captura_auto_vivi' } });
    expect(total).toBe(1);
  });

  it('caminho normal (sem concorrencia): mensagens sequenciais do mesmo lead nao duplicam a captura, sem regressao', async () => {
    const phoneNumber = '5511977776666';

    const primeiro = await capturarLeadMinimoUseCase.execute({ tenantId, phoneNumber, pushName: 'Mariana' });
    const segundo = await capturarLeadMinimoUseCase.execute({ tenantId, phoneNumber, pushName: 'Mariana' });

    expect(primeiro).not.toBeNull();
    expect(segundo).toBeNull();

    const total = await prisma.card.count({ where: { tenantId, phone: phoneNumber, origem: 'captura_auto_vivi' } });
    expect(total).toBe(1);
  });
});
