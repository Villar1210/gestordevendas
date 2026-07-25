// Indicador visual de proxima atividade pendente no card (commit 09130e9,
// Critico #3 da auditoria). Integracao (banco real, crm_core_db_test - ver
// jest.setup.ts): findProximasByCardIds e uma query pura - testar contra um
// repositorio mockado seria tautologico (nao provaria nada sobre a ordenacao
// real "atrasada vence futura" nem sobre o filtro done/scheduledAt). So um
// teste com Postgres de verdade valida a query.
// Instanciado DIRETO (sem NestFactory/AppModule) de proposito: bootstrapar
// o AppModule inteiro arrastaria o WhatsAppMarketingModule -> Baileys,
// pacote ESM puro que o transform padrao do Jest nao consegue carregar -
// nada a ver com a query sob teste aqui, que so depende do PrismaService.
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaActivityRepository } from './prisma-activity.repository';
import { IActivityRepository } from '../../domain/repositories/activity-repository.interface';

describe('PrismaActivityRepository.findProximasByCardIds (integracao - banco real)', () => {
  let prisma: PrismaService;
  let activityRepository: IActivityRepository;
  let tenantId: string;
  let pipelineId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    activityRepository = new PrismaActivityRepository(prisma);

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Atividade Pendente' } });
    tenantId = tenant.id;
    const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Pipeline Teste' } });
    pipelineId = pipeline.id;
  }, 30000);

  afterAll(async () => {
    await prisma.activity.deleteMany({ where: { tenantId } });
    await prisma.card.deleteMany({ where: { tenantId } });
    await prisma.pipeline.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  function criarCard(title: string) {
    return prisma.card.create({
      data: { tenantId, pipelineId, title, position: 0 },
    });
  }

  function criarAtividade(
    cardId: string,
    overrides: { type?: string; subject?: string | null; scheduledAt?: Date | null; done?: boolean },
  ) {
    return prisma.activity.create({
      data: {
        tenantId,
        cardId,
        type: overrides.type ?? 'ligacao',
        subject: overrides.subject ?? null,
        scheduledAt: overrides.scheduledAt ?? null,
        done: overrides.done ?? false,
      },
    });
  }

  const daqui = (minutos: number) => new Date(Date.now() + minutos * 60_000);

  it('retorna a atividade FUTURA de um card que so tem uma pendente', async () => {
    const card = await criarCard('Card com 1 atividade futura');
    await criarAtividade(card.id, { type: 'ligacao', subject: 'Ligar amanha', scheduledAt: daqui(60) });

    const resultado = await activityRepository.findProximasByCardIds([card.id]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ cardId: card.id, type: 'ligacao', subject: 'Ligar amanha' });
  });

  it('retorna a atividade ATRASADA de um card que so tem uma pendente (scheduledAt no passado, done=false)', async () => {
    const card = await criarCard('Card com 1 atividade atrasada');
    const atrasada = await criarAtividade(card.id, {
      type: 'tarefa',
      subject: 'Retornar contato',
      scheduledAt: daqui(-90),
    });

    const resultado = await activityRepository.findProximasByCardIds([card.id]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ cardId: card.id, type: 'tarefa', subject: 'Retornar contato' });
    expect(resultado[0].scheduledAt.getTime()).toBe(atrasada.scheduledAt!.getTime());
  });

  it('quando o card tem uma atividade ATRASADA e outra FUTURA, retorna a ATRASADA (mais urgente)', async () => {
    const card = await criarCard('Card com atrasada e futura');
    const futura = await criarAtividade(card.id, { type: 'reuniao', subject: 'Reuniao futura', scheduledAt: daqui(120) });
    const atrasada = await criarAtividade(card.id, { type: 'visita', subject: 'Visita atrasada', scheduledAt: daqui(-120) });

    const resultado = await activityRepository.findProximasByCardIds([card.id]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].type).toBe('visita');
    expect(resultado[0].subject).toBe('Visita atrasada');
    expect(resultado[0].scheduledAt.getTime()).toBe(atrasada.scheduledAt!.getTime());
    expect(resultado[0].scheduledAt.getTime()).not.toBe(futura.scheduledAt!.getTime());
  });

  it('ignora atividades CONCLUIDAS (done=true), mesmo que atrasadas', async () => {
    const card = await criarCard('Card so com atividade concluida');
    await criarAtividade(card.id, { type: 'tarefa', scheduledAt: daqui(-60), done: true });

    const resultado = await activityRepository.findProximasByCardIds([card.id]);

    expect(resultado).toHaveLength(0);
  });

  it('ignora atividades sem scheduledAt (nunca agendadas)', async () => {
    const card = await criarCard('Card com atividade sem data');
    await criarAtividade(card.id, { type: 'proposta', scheduledAt: null });

    const resultado = await activityRepository.findProximasByCardIds([card.id]);

    expect(resultado).toHaveLength(0);
  });

  it('card sem NENHUMA atividade pendente simplesmente nao aparece no resultado', async () => {
    const card = await criarCard('Card sem atividades');

    const resultado = await activityRepository.findProximasByCardIds([card.id]);

    expect(resultado).toHaveLength(0);
  });

  it('em lote (varios cardIds numa chamada so), retorna exatamente 1 entrada por card, sem contaminacao entre cards', async () => {
    const cardA = await criarCard('Card A - so futura');
    const cardB = await criarCard('Card B - atrasada e futura');
    const cardC = await criarCard('Card C - sem atividade pendente');

    await criarAtividade(cardA.id, { type: 'ligacao', subject: 'A-futura', scheduledAt: daqui(30) });
    await criarAtividade(cardB.id, { type: 'reuniao', subject: 'B-futura', scheduledAt: daqui(30) });
    await criarAtividade(cardB.id, { type: 'visita', subject: 'B-atrasada', scheduledAt: daqui(-30) });

    const resultado = await activityRepository.findProximasByCardIds([cardA.id, cardB.id, cardC.id]);
    const porCard = new Map(resultado.map((r) => [r.cardId, r]));

    expect(resultado).toHaveLength(2); // cardC fica de fora
    expect(porCard.get(cardA.id)).toMatchObject({ subject: 'A-futura' });
    expect(porCard.get(cardB.id)).toMatchObject({ subject: 'B-atrasada' });
    expect(porCard.has(cardC.id)).toBe(false);
  });

  it('lista vazia de cardIds retorna lista vazia sem consultar o banco desnecessariamente', async () => {
    const resultado = await activityRepository.findProximasByCardIds([]);
    expect(resultado).toEqual([]);
  });
});
