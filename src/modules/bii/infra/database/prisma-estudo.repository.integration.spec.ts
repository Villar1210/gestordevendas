// Fatia 5 (integracao - Postgres REAL): repositorio de estudos - ISOLAMENTO DE
// TENANT em leitura/edicao/exclusao, Json, FK SetNull da analise e cascata do
// tenant. Sem DATABASE_URL o teste e pulado.
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaEstudoRepository } from './prisma-estudo.repository';
import { PrismaBiiAnaliseRepository } from './prisma-bii-analise.repository';
import { NovoEstudo } from '../../domain/repositories/estudo-repository.interface';

const descrever = process.env.DATABASE_URL ? describe : describe.skip;

descrever('PrismaEstudoRepository (Postgres real)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaEstudoRepository(prisma);
  const analises = new PrismaBiiAnaliseRepository(prisma);
  const tenantIds: string[] = [];
  const USER = randomUUID();

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  async function analise(tenantId: string) {
    return analises.criar({
      tenantId,
      createdById: USER,
      impersonadoPor: null,
      enderecoDigitado: 'Rua Teste, 1',
      enderecoFormatado: 'Rua Teste, 1, São Paulo',
      lat: -23.6,
      lng: -46.5,
      precisao: 'rooftop',
      raioMetros: 1000,
      meses: 12,
      areaMin: null,
      areaMax: null,
      transacoes: 10,
      precoM2Mediano: 7000,
      resultado: { ok: true },
    });
  }

  const novo = (tenantId: string, analiseId: string, p: Partial<NovoEstudo> = {}): NovoEstudo => ({
    tenantId,
    userId: USER,
    analiseId,
    nome: 'Estudo teste BII',
    enderecoFormatado: 'Rua Teste, 1, São Paulo',
    raioMetros: 1000,
    meses: 12,
    tipologias: [{ descricao: '2 dorm.', areaPrivativa: 40, preco: 250000 }],
    premissas: { entradaPercentual: 20 },
    conclusao: 'Linha 1\nLinha 2',
    situacaoResumo: { ok: 1, atencao: 0, fora: 0 },
    resultado: { versao: 1, resumoExecutivo: { x: 1.5 } },
    ...p,
  });

  it('ISOLAMENTO DE TENANT + Json + SetNull + cascata', async () => {
    const tA = await prisma.tenant.create({ data: { name: 'BII F5 teste A' } });
    const tB = await prisma.tenant.create({ data: { name: 'BII F5 teste B' } });
    tenantIds.push(tA.id, tB.id);
    const anA = await analise(tA.id);
    const anB = await analise(tB.id);

    const a = await repo.criar(novo(tA.id, anA.id));
    const b = await repo.criar(novo(tB.id, anB.id, { nome: 'Do B' }));
    expect(a).toMatchObject({ nome: 'Estudo teste BII', analiseId: anA.id, conclusao: 'Linha 1\nLinha 2', situacaoResumo: { ok: 1, atencao: 0, fora: 0 } });
    expect(a.resultado).toEqual({ versao: 1, resumoExecutivo: { x: 1.5 } });

    expect((await repo.listarPorTenant(tA.id, 100)).map((e) => e.id)).toEqual([a.id]);
    expect(await repo.contarPorTenant(tB.id)).toBe(1);
    expect(await repo.buscarPorIdETenant(b.id, tA.id)).toBeNull();
    expect(await repo.atualizarTextos(b.id, tA.id, USER, { nome: 'Invadido' })).toBe(false);
    expect(await repo.excluir(b.id, tA.id)).toBe(false);
    expect((await repo.buscarPorIdETenant(b.id, tB.id))?.nome).toBe('Do B');

    // atualiza so os textos; conclusao null apaga
    expect(await repo.atualizarTextos(a.id, tA.id, USER, { conclusao: null })).toBe(true);
    const a2 = await repo.buscarPorIdETenant(a.id, tA.id);
    expect(a2).toMatchObject({ nome: 'Estudo teste BII', conclusao: null });
    expect(a2?.resultado).toEqual(a.resultado);

    // apagar a analise nao apaga o estudo (SetNull)
    await prisma.biiAnalise.delete({ where: { id: anA.id } });
    expect((await repo.buscarPorIdETenant(a.id, tA.id))?.analiseId).toBeNull();

    expect(await repo.excluir(a.id, tA.id)).toBe(true);
    expect(await repo.buscarPorIdETenant(a.id, tA.id)).toBeNull();

    // cascata do tenant
    await prisma.tenant.delete({ where: { id: tB.id } });
    expect(await prisma.biiEstudo.count({ where: { id: b.id } })).toBe(0);
  });
});
