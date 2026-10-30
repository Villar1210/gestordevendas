// Integracao (banco real, ver test/jest.setup.ts): cadastro de Construtoras
// (migration 20261030120000_construtoras). Isolamento por tenant, unique do
// nome normalizado, texto legado do empreendimento acompanhando o nome,
// DELETE bloqueado com vinculo e FK ON DELETE SET NULL. Inclui a conferencia
// de que a normalizacao SQL do backfill (mesma expressao da migration) bate
// com normalizarNomeConstrutora. Pula sozinho sem banco (DATABASE_URL).
import type { PrismaConstrutoraRepository } from './prisma-construtora.repository';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';
import { normalizarNomeConstrutora } from '../../domain/services/construtora';

const temBanco = !!process.env.DATABASE_URL;
const descrever = temBanco ? describe : describe.skip;

// Mesma expressao do backfill da migration 20261030120000_construtoras
// (valor sempre como parametro do $queryRaw em template tag).


descrever('PrismaConstrutoraRepository (integracao - banco real)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let repo: PrismaConstrutoraRepository;
  let tenantA: string;
  let tenantB: string;

  const emp = (tenantId: string, construtoraId: string | null, construtora: string | null) =>
    prisma.empreendimento.create({
      data: { tenantId, name: 'E', rua: 'r', numero: '1', bairro: 'b', cidade: 'c', uf: 'SP', cep: '0', construtoraId, construtora },
    });

  beforeAll(async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { PrismaService: Prisma } = require('../../../../config/prisma.service');
    const { PrismaConstrutoraRepository: Repo } = require('./prisma-construtora.repository');
    /* eslint-enable @typescript-eslint/no-require-imports */
    prisma = new Prisma();
    repo = new Repo(prisma);
    tenantA = (await prisma.tenant.create({ data: { name: `Construtoras A ${Date.now()}` } })).id;
    tenantB = (await prisma.tenant.create({ data: { name: `Construtoras B ${Date.now()}` } })).id;
  }, 30000);

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.$disconnect();
  });

  it('unique (tenant, nome normalizado) vira UniqueConstraintViolationError; outro tenant pode', async () => {
    await repo.create({ tenantId: tenantA, nome: 'Novolar', nomeNormalizado: 'novolar' });
    await expect(repo.create({ tenantId: tenantA, nome: 'NOVOLAR', nomeNormalizado: 'novolar' })).rejects.toBeInstanceOf(
      UniqueConstraintViolationError,
    );
    await expect(repo.create({ tenantId: tenantB, nome: 'Novolar', nomeNormalizado: 'novolar' })).resolves.toBeTruthy();
  });

  it('leitura/escrita/exclusao de outro tenant nao enxergam nem alteram', async () => {
    const deA = await repo.create({ tenantId: tenantA, nome: 'Somente A', nomeNormalizado: 'somente a' });
    expect(await repo.findByIdAndTenant(deA.id, tenantB)).toBeNull();
    expect(await repo.update(deA.id, tenantB, { sobre: 'invadido' })).toBeNull();
    expect(await repo.deleteSemVinculo(deA.id, tenantB)).toBeNull();
    expect((await repo.findAllByTenant(tenantB)).some((c) => c.id === deA.id)).toBe(false);
    expect((await repo.findByIdAndTenant(deA.id, tenantA))?.sobre).toBeNull();
  });

  it('renomear atualiza o texto legado dos empreendimentos vinculados; delete bloqueado com vinculo', async () => {
    const c = await repo.create({ tenantId: tenantA, nome: 'Riva', nomeNormalizado: 'riva' });
    const e = await emp(tenantA, c.id, 'Riva');
    const atualizada = await repo.update(c.id, tenantA, { nome: 'Riva Incorporadora', nomeNormalizado: 'riva incorporadora' });
    expect(atualizada).toMatchObject({ nome: 'Riva Incorporadora', quantidadeEmpreendimentos: 1 });
    expect((await prisma.empreendimento.findUnique({ where: { id: e.id } })).construtora).toBe('Riva Incorporadora');

    expect(await repo.deleteSemVinculo(c.id, tenantA)).toEqual({ vinculados: 1 });
    expect(await repo.findByIdAndTenant(c.id, tenantA)).not.toBeNull();

    // FK SET NULL (exclusao direta no banco nunca apaga o empreendimento).
    await prisma.construtora.delete({ where: { id: c.id } });
    const depois = await prisma.empreendimento.findUnique({ where: { id: e.id } });
    expect(depois.construtoraId).toBeNull();
    expect(depois.construtora).toBe('Riva Incorporadora');
  });

  it('sem vinculo: exclui', async () => {
    const c = await repo.create({ tenantId: tenantA, nome: 'Avulsa', nomeNormalizado: 'avulsa' });
    expect(await repo.deleteSemVinculo(c.id, tenantA)).toEqual({ vinculados: 0 });
    expect(await repo.findByIdAndTenant(c.id, tenantA)).toBeNull();
  });

  it.each([
    'Novolar',
    'NOVOLAR',
    '  novolar  ',
    'Novo   Lar',
    'Construtora Sólida',
    'CONSTRUÇÃO ÁGIL',
    'Ação Imóveis',
    'José',
    'Pão de Açúcar Ñandú',
    'Ëxtra\tÜmlaut',
  ])('normalizacao do backfill (SQL) bate com o dominio: %j', async (nome) => {
    const [linha] = await prisma.$queryRaw`SELECT btrim(regexp_replace(
      lower(regexp_replace(
        translate(
          btrim(regexp_replace(${nome}::text, '[[:space:]\u00a0]+', ' ', 'g')),
          'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑýÿÝ',
          'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY'
        ),
        '[\u0300-\u036f]', '', 'g'
      )),
      '[[:space:]\u00a0]+', ' ', 'g'
    )) AS n`;
    expect(linha.n).toBe(normalizarNomeConstrutora(nome));
  });
});
