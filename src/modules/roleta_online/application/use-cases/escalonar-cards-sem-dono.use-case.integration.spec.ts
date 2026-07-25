// Rede de seguranca "sem corretor online" (Camada 2 - escalonamento por
// tempo, commit 8df8e29). Integracao (banco real, crm_core_db_test - ver
// jest.setup.ts): a garantia critica aqui ("nao duplicar notificacao") vive
// literalmente no filtro `escalonamentoNotificadoEm: null` da query Prisma
// (ver PrismaCardRepository.findInboxUnnotifiedOlderThan) - um repositorio
// mockado nunca pegaria um bug nesse filtro, entao so um teste contra
// Postgres real da confianca de verdade aqui.
// Instanciado DIRETO (sem NestFactory/AppModule) de proposito: bootstrapar
// o AppModule inteiro arrastaria o WhatsAppMarketingModule -> Baileys, pacote
// ESM puro que o transform padrao do Jest nao consegue carregar - nada a
// ver com a logica sob teste aqui, que so depende de ICardRepository +
// EventEmitter2 (as mesmas 2 dependencias reais do construtor do use case).
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaCardRepository } from '../../../vendas_kanban/infra/database/prisma-card.repository';
import {
  EscalonarCardsSemDonoUseCase,
  ESCALONAMENTO_MINUTOS_LIMITE,
} from './escalonar-cards-sem-dono.use-case';

describe('EscalonarCardsSemDonoUseCase (integracao - banco real)', () => {
  let prisma: PrismaService;
  let useCase: EscalonarCardsSemDonoUseCase;
  let emitter: EventEmitter2;
  let tenantId: string;
  let pipelineId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    const cardRepository = new PrismaCardRepository(prisma);
    emitter = new EventEmitter2();
    useCase = new EscalonarCardsSemDonoUseCase(cardRepository, emitter);

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Escalonamento Card' } });
    tenantId = tenant.id;
    const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Pipeline Teste' } });
    pipelineId = pipeline.id;
  }, 30000);

  afterAll(async () => {
    await prisma.card.deleteMany({ where: { tenantId } });
    await prisma.stage.deleteMany({ where: { tenantId } });
    await prisma.pipeline.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  function criarCard(minutosAtras: number, overrides: Record<string, unknown> = {}) {
    return prisma.card.create({
      data: {
        tenantId,
        pipelineId,
        title: `Card teste (${minutosAtras}min atras)`,
        position: 0,
        stageId: null,
        ownerId: null,
        createdAt: new Date(Date.now() - minutosAtras * 60_000),
        ...overrides,
      },
    });
  }

  function eventosDoCard(emitSpy: jest.SpyInstance, cardId: string) {
    return emitSpy.mock.calls.filter(
      ([nome, payload]) => nome === 'card.sem_dono.escalonado' && (payload as any)?.cardId === cardId,
    );
  }

  it('escalona card sem dono/sem stage ha mais de 15min e nao duplica numa segunda execucao', async () => {
    const cardAntigo = await criarCard(ESCALONAMENTO_MINUTOS_LIMITE + 5);
    const emitSpy = jest.spyOn(emitter, 'emit');

    await useCase.execute();

    const atualizado = await prisma.card.findUnique({ where: { id: cardAntigo.id } });
    expect(atualizado?.escalonamentoNotificadoEm).not.toBeNull();
    expect(eventosDoCard(emitSpy, cardAntigo.id)).toHaveLength(1);

    // Segunda execucao (simula o proximo tick do @Cron a cada 5min) - o
    // card ja esta marcado, NAO pode gerar um segundo evento/notificacao.
    emitSpy.mockClear();
    await useCase.execute();
    expect(eventosDoCard(emitSpy, cardAntigo.id)).toHaveLength(0);

    emitSpy.mockRestore();
  });

  it('NAO escalona card sem dono criado ha menos de 15min', async () => {
    const cardRecente = await criarCard(5);
    const emitSpy = jest.spyOn(emitter, 'emit');

    await useCase.execute();

    const atualizado = await prisma.card.findUnique({ where: { id: cardRecente.id } });
    expect(atualizado?.escalonamentoNotificadoEm).toBeNull();
    expect(eventosDoCard(emitSpy, cardRecente.id)).toHaveLength(0);

    emitSpy.mockRestore();
  });

  it('NAO escalona card antigo que ja tem stage (nao esta mais na Caixa de Entrada)', async () => {
    const stage = await prisma.stage.create({
      data: { tenantId, pipelineId, name: 'Em Atendimento', position: 0 },
    });
    const cardComStage = await criarCard(ESCALONAMENTO_MINUTOS_LIMITE + 20, { stageId: stage.id });
    const emitSpy = jest.spyOn(emitter, 'emit');

    await useCase.execute();

    const atualizado = await prisma.card.findUnique({ where: { id: cardComStage.id } });
    expect(atualizado?.escalonamentoNotificadoEm).toBeNull();
    expect(eventosDoCard(emitSpy, cardComStage.id)).toHaveLength(0);

    emitSpy.mockRestore();
  });

  it('evento emitido carrega minutosAguardando coerente com a idade real do card', async () => {
    const minutosAtras = ESCALONAMENTO_MINUTOS_LIMITE + 30;
    const card = await criarCard(minutosAtras, { title: 'Lead urgente de teste', phone: '5511988887777' });
    const emitSpy = jest.spyOn(emitter, 'emit');

    await useCase.execute();

    const [, payload] = eventosDoCard(emitSpy, card.id)[0] ?? [];
    expect(payload).toMatchObject({
      tenantId,
      cardId: card.id,
      title: 'Lead urgente de teste',
      phone: '5511988887777',
    });
    expect((payload as any).minutosAguardando).toBeGreaterThanOrEqual(minutosAtras - 1);

    emitSpy.mockRestore();
  });
});
