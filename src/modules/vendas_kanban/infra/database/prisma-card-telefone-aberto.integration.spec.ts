// Fase B (27/10/2026): busca de cards ABERTOS pelo telefone (base da regra
// "mesmo cliente nao vira 2 cards"). Banco real: o filtro de relacao
// (etapa != Fechamento, funil != remarketing) so se prova no Postgres.
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaCardRepository } from './prisma-card.repository';
import { REMARKETING_PIPELINE_NOME } from '../../domain/services/remarketing-pipeline';

const temBanco = !!process.env.DATABASE_URL;
(temBanco ? describe : describe.skip)('PrismaCardRepository.findAbertosPorTrechoTelefone (integracao)', () => {
  let prisma: PrismaService;
  let repo: PrismaCardRepository;
  let tenantId: string;
  let ids: Record<string, string>;

  beforeAll(async () => {
    prisma = new PrismaService();
    repo = new PrismaCardRepository(prisma);
    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Telefone Aberto' } });
    tenantId = tenant.id;
    const vendas = await prisma.pipeline.create({ data: { tenantId, name: 'Vendas' } });
    const rmk = await prisma.pipeline.create({ data: { tenantId, name: REMARKETING_PIPELINE_NOME } });
    const atend = await prisma.stage.create({ data: { tenantId, pipelineId: vendas.id, name: 'Em Atendimento', position: 0 } });
    const fech = await prisma.stage.create({ data: { tenantId, pipelineId: vendas.id, name: 'Fechamento', position: 4 } });
    const rep = await prisma.stage.create({ data: { tenantId, pipelineId: vendas.id, name: 'Repique', position: 5 } });
    const rmkStage = await prisma.stage.create({ data: { tenantId, pipelineId: rmk.id, name: 'Aguardando', position: 0 } });

    const criar = (title: string, pipelineId: string, stageId: string | null, phone: string) =>
      prisma.card.create({ data: { tenantId, pipelineId, stageId, title, phone, position: 0 } });
    ids = {
      atendimento: (await criar('atendimento', vendas.id, atend.id, '(11) 97387-9858')).id,
      caixa: (await criar('caixa', vendas.id, null, '5511973879858')).id,
      repique: (await criar('repique', vendas.id, rep.id, '11 7387-9858')).id,
      fechamento: (await criar('fechamento', vendas.id, fech.id, '11973879858')).id,
      remarketing: (await criar('remarketing', rmk.id, rmkStage.id, '11973879858')).id,
      outro: (await criar('outro', vendas.id, atend.id, '11900000000')).id,
    };
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('traz os abertos com o trecho, fora Fechamento e remarketing, com nome da etapa', async () => {
    const achados = await repo.findAbertosPorTrechoTelefone(tenantId, '9858');
    const porId = new Map(achados.map((c) => [c.id, c]));
    expect(porId.has(ids.atendimento)).toBe(true);
    expect(porId.has(ids.caixa)).toBe(true);
    expect(porId.has(ids.repique)).toBe(true);
    expect(porId.has(ids.fechamento)).toBe(false);
    expect(porId.has(ids.remarketing)).toBe(false);
    expect(porId.has(ids.outro)).toBe(false);
    expect(porId.get(ids.repique)!.stageName).toBe('Repique');
    expect(porId.get(ids.caixa)!.stageName).toBeNull();
  });

  it('moverParaCaixaDeEntrada limpa etapa e dono', async () => {
    await repo.moverParaCaixaDeEntrada(ids.repique);
    const card = await prisma.card.findUnique({ where: { id: ids.repique } });
    expect(card!.stageId).toBeNull();
    expect(card!.ownerId).toBeNull();
  });

  it('coluna Atendimento VIVI: fica fora da Caixa de Entrada e da fila da Roleta', async () => {
    const pipelineId = (await prisma.card.findUnique({ where: { id: ids.caixa } }))!.pipelineId;
    const vivi = await prisma.card.create({
      data: { tenantId, pipelineId, stageId: null, title: 'vivi', phone: '11955554444', position: 0 },
    });
    await repo.marcarAtendimentoVivi(vivi.id, new Date('2026-10-01T12:00:00Z'));

    const caixa = await repo.findAllByPipelineInbox(pipelineId);
    expect(caixa.map((c) => c.id)).not.toContain(vivi.id);
    expect((await repo.findAllInboxByTenant(tenantId)).map((c) => c.id)).not.toContain(vivi.id);
    expect((await repo.findInboxUnnotifiedOlderThan(new Date('2100-01-01'))).map((c) => c.id)).not.toContain(vivi.id);

    const coluna = await repo.findAtendimentoViviByPipeline(pipelineId);
    expect(coluna.map((c) => c.id)).toEqual([vivi.id]);
    expect(coluna[0].emAtendimentoVivi).toBe(true);

    const parados = await repo.findAtendimentoViviSemInteracaoDesde(new Date('2026-10-05T00:00:00Z'));
    expect(parados.map((c) => c.id)).toContain(vivi.id);
    await repo.registrarInteracaoVivi(vivi.id, new Date('2026-10-10T00:00:00Z'));
    expect((await repo.findAtendimentoViviSemInteracaoDesde(new Date('2026-10-05T00:00:00Z'))).map((c) => c.id)).not.toContain(vivi.id);

    await repo.sairDoAtendimentoVivi(vivi.id);
    expect((await repo.findAllByPipelineInbox(pipelineId)).map((c) => c.id)).toContain(vivi.id);
  });
});
