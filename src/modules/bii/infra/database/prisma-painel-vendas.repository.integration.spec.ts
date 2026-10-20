// Isolamento multitenant do Painel de Vendas (integracao - Postgres REAL).
// Dois tenants com dados parecidos (mesmos nomes de etapa, mesma origem,
// valores diferentes): nada do tenant B pode aparecer no painel do tenant A,
// nem passando o pipelineId/corretorId do B. Inclui o listener gravando pelo
// repositorio real (evento com stage de outro tenant nao e gravado).
// Instanciado DIRETO (sem AppModule), mesmo padrao de
// vendas_kanban/infra/database/prisma-activity.repository.integration.spec.ts.
// Precisa de DATABASE_URL apontando para um banco com as migrations aplicadas;
// sem ela o teste e pulado. Comando:
//   DATABASE_URL=postgresql://... npx jest src/modules/bii --runInBand
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaPainelVendasRepository } from './prisma-painel-vendas.repository';
import { PrismaCardStageEventoRepository } from './prisma-card-stage-evento.repository';
import { GetPainelVendasUseCase } from '../../application/use-cases/get-painel-vendas.use-case';
import { CardStageChangedListener } from '../listeners/card-stage-changed.listener';
import { FiltroPainel } from '../../domain/repositories/painel-vendas-repository.interface';
import { Test } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { BiiModule } from '../../bii.module';

const descrever = process.env.DATABASE_URL ? describe : describe.skip;

interface Semente {
  tenantId: string;
  pipelineId: string;
  stages: Record<'atendimento' | 'visita' | 'fechamento' | 'repique', string>;
  userId: string;
  cardIds: string[];
}

descrever('BII - isolamento de tenant no Painel de Vendas (integracao - banco real)', () => {
  let prisma: PrismaService;
  let repo: PrismaPainelVendasRepository;
  let eventoRepo: PrismaCardStageEventoRepository;
  let A: Semente;
  let B: Semente;
  const tenantIds: string[] = [];

  const jul = (dia: number, h = 12) => new Date(2026, 6, dia, h);

  async function semear(nome: string, valorGanho: number, corretor: string): Promise<Semente> {
    const tenant = await prisma.tenant.create({ data: { name: `BII teste ${nome}` } });
    tenantIds.push(tenant.id);
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Corretor' } });
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: corretor,
        email: `bii-${randomUUID()}@teste.local`,
        password: 'x',
        roleId: role.id,
      },
    });
    const pipeline = await prisma.pipeline.create({ data: { tenantId: tenant.id, name: 'Vendas' } });
    const mk = (name: string, position: number) =>
      prisma.stage.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, name, position } });
    const stages = {
      atendimento: (await mk('Em Atendimento', 1)).id,
      visita: (await mk('Visita', 2)).id,
      fechamento: (await mk('Fechamento', 3)).id,
      repique: (await mk('Repique', 4)).id,
    };
    const card = (title: string, value: number, createdAt: Date) =>
      prisma.card.create({
        data: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          stageId: stages.atendimento,
          ownerId: user.id,
          title,
          value,
          position: 0,
          origem: 'site',
          createdAt,
        },
      });
    const c1 = await card('Lead ganho', valorGanho, jul(1));
    const c2 = await card('Lead perdido', 0, jul(2));
    const ev = (cardId: string, toStageId: string, toStageNome: string, ocorridoEm: Date, motivoRepique: string | null = null) => ({
      tenantId: tenant.id,
      cardId,
      pipelineId: pipeline.id,
      toStageId,
      toStageNome,
      origem: 'move',
      motivoRepique,
      ocorridoEm,
    });
    await prisma.biiCardStageEvento.createMany({
      data: [
        ev(c1.id, stages.atendimento, 'Em Atendimento', jul(1)),
        ev(c1.id, stages.fechamento, 'Fechamento', jul(11)),
        ev(c2.id, stages.atendimento, 'Em Atendimento', jul(2)),
        ev(c2.id, stages.repique, 'Repique', jul(5), 'PRECO'),
      ],
    });
    return { tenantId: tenant.id, pipelineId: pipeline.id, stages, userId: user.id, cardIds: [c1.id, c2.id] };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    repo = new PrismaPainelVendasRepository(prisma);
    eventoRepo = new PrismaCardStageEventoRepository(prisma);
    A = await semear('A', 300000, 'Corretor A');
    B = await semear('B', 999999, 'Corretor B');
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.biiCardStageEvento.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.card.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.stage.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.pipeline.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      await prisma.$disconnect();
    }
  }, 60000);

  const filtro = (s: Semente, extra: Partial<FiltroPainel> = {}): FiltroPainel => ({
    tenantId: s.tenantId,
    pipelineId: s.pipelineId,
    inicio: new Date(2026, 6, 1),
    fimExclusivo: new Date(2026, 7, 1),
    ...extra,
  });

  it('listagens basicas so devolvem dados do proprio tenant', async () => {
    expect(await repo.listarPipelines(A.tenantId)).toEqual([{ id: A.pipelineId, nome: 'Vendas' }]);
    expect((await repo.listarEtapas(A.tenantId, A.pipelineId)).map((e) => e.id)).toEqual([
      A.stages.atendimento,
      A.stages.visita,
      A.stages.fechamento,
      A.stages.repique,
    ]);
    expect(await repo.listarCorretores(A.tenantId, A.pipelineId)).toEqual([{ id: A.userId, nome: 'Corretor A' }]);
    expect(await repo.listarOrigens(A.tenantId, A.pipelineId)).toEqual(['site']);
  });

  it('pipelineId do tenant B consultado pelo tenant A: tudo vazio', async () => {
    expect(await repo.listarEtapas(A.tenantId, B.pipelineId)).toEqual([]);
    expect(await repo.listarCorretores(A.tenantId, B.pipelineId)).toEqual([]);
    expect(await repo.listarOrigens(A.tenantId, B.pipelineId)).toEqual([]);
    expect(await repo.listarCardsCriados(filtro(A, { pipelineId: B.pipelineId }))).toEqual([]);
    expect(await repo.listarEventosEntrada(filtro(A, { pipelineId: B.pipelineId }))).toEqual([]);
  });

  it('cards e eventos do periodo: so do tenant A (nunca ids do B)', async () => {
    const cards = await repo.listarCardsCriados(filtro(A));
    const eventos = await repo.listarEventosEntrada(filtro(A));
    expect(cards.map((c) => c.cardId).sort()).toEqual([...A.cardIds].sort());
    expect(eventos).toHaveLength(4);
    for (const e of eventos) {
      expect(A.cardIds).toContain(e.cardId);
      expect(B.cardIds).not.toContain(e.cardId);
    }
    // Decimal -> number
    expect(eventos.find((e) => e.toStageNome === 'Fechamento')!.card.value).toBe(300000);
  });

  it('filtro por corretor do tenant B no tenant A: vazio', async () => {
    expect(await repo.listarCardsCriados(filtro(A, { corretorId: B.userId }))).toEqual([]);
    expect(await repo.listarEventosEntrada(filtro(A, { corretorId: B.userId }))).toEqual([]);
  });

  it('historicoDesde por tenant', async () => {
    expect(await repo.buscarInicioHistorico(A.tenantId)).toEqual(jul(1));
    expect(await repo.buscarInicioHistorico(randomUUID())).toBeNull();
  });

  it('painel completo do tenant A (use case + repositorio real) nao enxerga o B', async () => {
    const uc = new GetPainelVendasUseCase(repo);
    const r = await uc.execute({
      tenantId: A.tenantId,
      requesterRole: 'Administrador',
      de: new Date(2026, 6, 1),
      ate: new Date(2026, 6, 31),
    });
    expect(r.pipelines).toEqual([{ id: A.pipelineId, nome: 'Vendas' }]);
    expect(r.resumo).toMatchObject({ leadsNovos: 2, ganhos: 1, perdidos: 1, vgvGanho: 300000, cicloMedioDias: 10 });
    expect(r.ranking).toEqual([
      { corretorId: A.userId, nome: 'Corretor A', leads: 2, ganhos: 1, conversaoPct: 50, vgv: 300000 },
    ]);
    expect(JSON.stringify(r)).not.toContain(B.pipelineId);
    expect(JSON.stringify(r)).not.toContain(B.userId);
    expect(JSON.stringify(r)).not.toContain('999999');
    await expect(uc.execute({ tenantId: A.tenantId, requesterRole: 'Administrador', pipelineId: B.pipelineId })).rejects.toThrow(
      'Funil não encontrado.',
    );
  });

  it('listener grava com o nome da etapa do proprio tenant e recusa stage/card de outro tenant', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const listener = new CardStageChangedListener(eventoRepo);
    const base = {
      tenantId: A.tenantId,
      cardId: A.cardIds[1],
      pipelineId: A.pipelineId,
      fromStageId: A.stages.atendimento,
      userId: A.userId,
      origem: 'move' as const,
      ocorridoEm: jul(20),
    };
    await listener.handle({ ...base, toStageId: A.stages.visita });
    await listener.handle({ ...base, toStageId: B.stages.visita }); // stage do B
    await listener.handle({ ...base, cardId: B.cardIds[0], toStageId: A.stages.visita }); // card do B
    const gravados = await prisma.biiCardStageEvento.findMany({
      where: { tenantId: { in: tenantIds }, ocorridoEm: jul(20) },
    });
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      tenantId: A.tenantId,
      cardId: A.cardIds[1],
      toStageId: A.stages.visita,
      toStageNome: 'Visita',
      fromStageNome: 'Em Atendimento',
    });
    warn.mockRestore();
  });

  it('wiring do BiiModule: emit("card.stage.changed") chega ao listener e grava no banco', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), BiiModule],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    try {
      app.get(EventEmitter2).emit('card.stage.changed', {
        tenantId: A.tenantId,
        cardId: A.cardIds[0],
        pipelineId: A.pipelineId,
        fromStageId: null,
        toStageId: A.stages.visita,
        userId: null,
        origem: 'claim',
        ocorridoEm: jul(25),
      });
      let gravado = null;
      for (let i = 0; i < 50 && !gravado; i++) {
        await new Promise((r) => setTimeout(r, 100));
        gravado = await prisma.biiCardStageEvento.findFirst({
          where: { tenantId: A.tenantId, ocorridoEm: jul(25) },
        });
      }
      expect(gravado).toMatchObject({ cardId: A.cardIds[0], toStageNome: 'Visita', origem: 'claim', userId: null });
    } finally {
      await app.close();
    }
  });
});
