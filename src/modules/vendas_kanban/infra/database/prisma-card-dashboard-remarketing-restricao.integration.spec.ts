// Escopo estrutural (nao RBAC) do Dashboard do Corretor: cards do pipeline
// de remarketing ("Leads Nao Qualificados") nunca devem contar/aparecer nas
// duas queries usadas por GetMeuDashboardUseCase, mesmo com ownerId
// corretamente preenchido - vale para qualquer dono, Administrador incluso,
// ja que a exclusao e por pipeline, nao por role de quem esta consultando
// (ver domain/services/remarketing-pipeline.ts e get-meu-dashboard.use-case.ts).
// Integracao (banco real, crm_core_db_test - ver jest.setup.ts): as duas
// queries sob teste (groupBy/findMany com filtro de relacao "pipeline.name")
// sao Prisma puro - testar contra um repositorio mockado seria tautologico,
// nao provaria que o filtro de relacao realmente exclui o pipeline certo no
// banco de verdade.
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaCardRepository } from './prisma-card.repository';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { REMARKETING_PIPELINE_NOME } from '../../domain/services/remarketing-pipeline';

describe('PrismaCardRepository - exclusao do pipeline de remarketing no Dashboard do Corretor (integracao - banco real)', () => {
  let prisma: PrismaService;
  let cardRepository: ICardRepository;
  let tenantId: string;
  let pipelineVendasId: string;
  let pipelineRemarketingId: string;
  let stageVendasId: string;
  let stageRemarketingId: string;
  let ownerId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    cardRepository = new PrismaCardRepository(prisma);

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Dashboard Remarketing' } });
    tenantId = tenant.id;

    const pipelineVendas = await prisma.pipeline.create({ data: { tenantId, name: 'Vendas' } });
    pipelineVendasId = pipelineVendas.id;
    const stageVendas = await prisma.stage.create({
      data: { tenantId, pipelineId: pipelineVendasId, name: 'Em Atendimento', position: 0 },
    });
    stageVendasId = stageVendas.id;

    const pipelineRemarketing = await prisma.pipeline.create({
      data: { tenantId, name: REMARKETING_PIPELINE_NOME },
    });
    pipelineRemarketingId = pipelineRemarketing.id;
    const stageRemarketing = await prisma.stage.create({
      data: { tenantId, pipelineId: pipelineRemarketingId, name: 'Aguardando Reengajamento', position: 0 },
    });
    stageRemarketingId = stageRemarketing.id;

    const role = await prisma.role.create({ data: { tenantId, name: 'Administrador' } });
    const owner = await prisma.user.create({
      data: {
        tenantId,
        name: 'Dono Teste',
        email: `dono-dashboard-remarketing-${Date.now()}@teste.local`,
        password: 'hash-fake',
        roleId: role.id,
      },
    });
    ownerId = owner.id;
  }, 30000);

  afterAll(async () => {
    await prisma.card.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.stage.deleteMany({ where: { tenantId } });
    await prisma.pipeline.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  function criarCardVendas(title: string) {
    return prisma.card.create({
      data: {
        tenantId,
        pipelineId: pipelineVendasId,
        stageId: stageVendasId,
        ownerId,
        title,
        position: 0,
      },
    });
  }

  function criarCardRemarketing(title: string) {
    return prisma.card.create({
      data: {
        tenantId,
        pipelineId: pipelineRemarketingId,
        stageId: stageRemarketingId,
        ownerId,
        title,
        position: 0,
      },
    });
  }

  it('countByOwnerGroupedByStage: NAO conta cards do pipeline de remarketing, mesmo com ownerId preenchido', async () => {
    const cardVendas = await criarCardVendas('Card real de vendas');
    await criarCardRemarketing('Card de remarketing com dono corrigido manualmente');

    const grupos = await cardRepository.countByOwnerGroupedByStage(tenantId, ownerId);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].stageId).toBe(stageVendasId);
    expect(grupos[0].count).toBe(1);

    await prisma.card.delete({ where: { id: cardVendas.id } });
  });

  it('findRecentByOwner: NAO retorna cards do pipeline de remarketing, mesmo com ownerId preenchido', async () => {
    const cardVendas = await criarCardVendas('Card real de vendas (recentes)');
    await criarCardRemarketing('Card de remarketing (recentes)');

    const recentes = await cardRepository.findRecentByOwner(tenantId, ownerId, 10);

    expect(recentes.map((c) => c.id)).toEqual([cardVendas.id]);
    expect(recentes.every((c) => c.pipelineId === pipelineVendasId)).toBe(true);

    await prisma.card.delete({ where: { id: cardVendas.id } });
  });
});
