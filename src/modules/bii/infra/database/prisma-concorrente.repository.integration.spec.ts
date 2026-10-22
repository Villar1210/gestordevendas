// Fatia 3 (integracao - Postgres REAL): repositorio de concorrentes -
// ISOLAMENTO DE TENANT em leitura/bbox/edicao/exclusao, substituicao das
// tipologias numa transacao, Decimal -> number, @db.Date e cascata. Sem
// DATABASE_URL o teste e pulado.
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaConcorrenteRepository } from './prisma-concorrente.repository';
import { DadosConcorrente } from '../../domain/repositories/concorrente-repository.interface';
import { boundingBox } from '../../domain/services/geo';
import { dataUtc } from '../../domain/services/data-utc';

const descrever = process.env.DATABASE_URL ? describe : describe.skip;
const CENTRO = { lat: -23.7001, lng: -46.4001 };

function dados(p: Partial<DadosConcorrente> = {}): DadosConcorrente {
  return {
    nome: 'Residencial Teste BII',
    construtora: 'Construtora Teste',
    endereco: 'Rua Teste, 1, São Paulo',
    enderecoFormatado: 'Rua Teste, 1',
    lat: CENTRO.lat,
    lng: CENTRO.lng,
    precisao: 'rooftop',
    fase: 'lancamento',
    dataLancamento: dataUtc(2026, 4, 1),
    totalUnidades: 200,
    unidadesVendidas: 50,
    fonte: 'stand',
    fonteUrl: 'https://exemplo.com.br/x',
    observacoes: 'obs',
    tipologias: [
      { descricao: '2 dorm.', dormitorios: 2, areaPrivativa: 42.5, precoDe: 289_000, precoAte: 310_000.5 },
      { descricao: '3 dorm.', dormitorios: 3, areaPrivativa: 60, precoDe: 450_000, precoAte: null },
    ],
    ...p,
  };
}

descrever('PrismaConcorrenteRepository (Postgres real)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaConcorrenteRepository(prisma);
  const tenantIds: string[] = [];
  const USER = randomUUID();

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('ISOLAMENTO DE TENANT + tipologias + cascata', async () => {
    const tA = await prisma.tenant.create({ data: { name: 'BII F3 teste A' } });
    const tB = await prisma.tenant.create({ data: { name: 'BII F3 teste B' } });
    tenantIds.push(tA.id, tB.id);

    const a = await repo.criar(tA.id, USER, dados());
    const b = await repo.criar(tB.id, USER, dados({ nome: 'Do B' }));
    await repo.criar(tA.id, USER, dados({ nome: 'Longe', lat: CENTRO.lat + 0.1 }));

    expect(a).toMatchObject({ nome: 'Residencial Teste BII', origem: 'manual', fase: 'lancamento' });
    expect(a.dataLancamento?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(a.tipologias).toEqual([
      { descricao: '2 dorm.', dormitorios: 2, areaPrivativa: 42.5, precoDe: 289_000, precoAte: 310_000.5 },
      { descricao: '3 dorm.', dormitorios: 3, areaPrivativa: 60, precoDe: 450_000, precoAte: null },
    ]);

    expect((await repo.listarPorTenant(tA.id, 300)).map((c) => c.nome).sort()).toEqual(['Longe', 'Residencial Teste BII']);
    expect((await repo.listarPorTenant(tB.id, 300)).map((c) => c.id)).toEqual([b.id]);
    expect(await repo.contarPorTenant(tA.id)).toBe(2);
    expect(await repo.buscarPorIdETenant(b.id, tA.id)).toBeNull();
    expect((await repo.buscarNoBbox(tA.id, boundingBox(CENTRO, 1000), 500)).map((c) => c.id)).toEqual([a.id]);
    expect((await repo.buscarNoBbox(tB.id, boundingBox(CENTRO, 1000), 500)).map((c) => c.id)).toEqual([b.id]);

    // editar/excluir de outro tenant: nada acontece
    expect(await repo.atualizar(b.id, tA.id, USER, dados({ nome: 'Invadido' }))).toBe(false);
    expect(await repo.excluir(b.id, tA.id)).toBe(false);
    expect((await repo.buscarPorIdETenant(b.id, tB.id))?.nome).toBe('Do B');
    expect(await prisma.biiConcorrenteTipologia.count({ where: { concorrenteId: b.id } })).toBe(2);

    // edicao substitui as tipologias
    const outro = randomUUID();
    expect(await repo.atualizar(a.id, tA.id, outro, dados({ nome: 'Editado', tipologias: [{ descricao: 'Studio', dormitorios: 0, areaPrivativa: 25, precoDe: 200_000, precoAte: null }] }))).toBe(true);
    const editado = await repo.buscarPorIdETenant(a.id, tA.id);
    expect(editado).toMatchObject({ nome: 'Editado', tipologias: [{ descricao: 'Studio', areaPrivativa: 25 }] });
    expect(await prisma.biiConcorrente.findUnique({ where: { id: a.id }, select: { createdById: true, updatedById: true } })).toEqual({ createdById: USER, updatedById: outro });

    // excluir apaga as tipologias (cascata)
    expect(await repo.excluir(a.id, tA.id)).toBe(true);
    expect(await prisma.biiConcorrenteTipologia.count({ where: { concorrenteId: a.id } })).toBe(0);

    // excluir o tenant apaga os concorrentes dele
    await prisma.tenant.delete({ where: { id: tB.id } });
    tenantIds.splice(tenantIds.indexOf(tB.id), 1);
    expect(await prisma.biiConcorrente.count({ where: { id: b.id } })).toBe(0);
  });
});
