// Fase B (revisao H1): mensagens em rajada do mesmo cliente (a VIVI chama a
// rota a cada mensagem) nao podem criar 2 cards. Banco real.
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaCardRepository } from '../../infra/database/prisma-card.repository';
import { PrismaPipelineRepository } from '../../infra/database/prisma-pipeline.repository';
import { PrismaStageRepository } from '../../infra/database/prisma-stage.repository';
import { CardAbertoPorTelefoneService } from '../services/card-aberto-por-telefone.service';
import { RegistrarAtendimentoViviUseCase } from './registrar-atendimento-vivi.use-case';

const temBanco = !!process.env.DATABASE_URL;
(temBanco ? describe : describe.skip)('RegistrarAtendimentoVivi - rajada (integracao)', () => {
  let prisma: PrismaService;
  let tenantId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Rajada VIVI' } });
    tenantId = tenant.id;
    const p = await prisma.pipeline.create({ data: { tenantId, name: 'Vendas' } });
    await prisma.stage.create({ data: { tenantId, pipelineId: p.id, name: 'Em Atendimento', position: 0 } });
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('5 mensagens ao mesmo tempo -> 1 card so', async () => {
    const cards = new PrismaCardRepository(prisma);
    const useCase = new RegistrarAtendimentoViviUseCase(
      cards,
      new PrismaPipelineRepository(prisma),
      new PrismaStageRepository(prisma),
      new CardAbertoPorTelefoneService(cards),
      { emit: jest.fn(), emitAsync: jest.fn() } as never,
    );
    const resultados = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => useCase.execute({ tenantId, phone: '5511977770000', mensagem: `msg ${i}` })),
    );
    expect(new Set(resultados.map((r) => r.cardId)).size).toBe(1);
    expect(resultados.filter((r) => r.criado)).toHaveLength(1);
    expect(await prisma.card.count({ where: { tenantId } })).toBe(1);
  });
});
