// Integracao (banco real, ver test/jest.setup.ts): transacao do book
// completo - substitui o anterior, grava paginas + fotos juntos, desfaz tudo
// em falha, cascata ao apagar o empreendimento e isolamento por tenant.
// Pula sozinho se nao houver banco acessivel (DATABASE_URL). Prisma e o
// repositorio sao carregados so quando ha banco: sem o client gerado
// (src/generated), a suite e pulada em vez de falhar na compilacao.
import { randomUUID } from 'crypto';
import type { PrismaEmpreendimentoBookRepository } from './prisma-empreendimento-book.repository';

const temBanco = !!process.env.DATABASE_URL;
const descrever = temBanco ? describe : describe.skip;

descrever('PrismaEmpreendimentoBookRepository (integracao - banco real)', () => {
  // Tipado solto de proposito: sem o client gerado o PrismaService nao tem os
  // models e a suite (que entao e pulada) nem compilaria.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let repo: PrismaEmpreendimentoBookRepository;
  let tenantA: string;
  let tenantB: string;
  let empId: string;

  const pagina = (numero: number, categoria: string) => ({
    numero,
    categoria,
    url: `/uploads/imoveis/p${numero}-${randomUUID()}.jpg`,
    largura: 1600,
    altura: 1131,
  });

  beforeAll(async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { PrismaService: Prisma } = require('../../../../config/prisma.service');
    const { PrismaEmpreendimentoBookRepository: Repo } = require('./prisma-empreendimento-book.repository');
    /* eslint-enable @typescript-eslint/no-require-imports */
    prisma = new Prisma();
    repo = new Repo(prisma);
    tenantA = (await prisma.tenant.create({ data: { name: `Tenant Book A ${Date.now()}` } })).id;
    tenantB = (await prisma.tenant.create({ data: { name: `Tenant Book B ${Date.now()}` } })).id;
    empId = (
      await prisma.empreendimento.create({
        data: { tenantId: tenantA, name: 'Book Teste', rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', cep: '01000-000' },
      })
    ).id;
  }, 30000);

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.$disconnect();
  });

  it('grava book + paginas + fotos; reimportar substitui e devolve as urls antigas', async () => {
    const id1 = randomUUID();
    const paginas1 = [pagina(2, 'descartar'), pagina(1, 'fachada'), pagina(3, 'ficha_tecnica')];
    const r1 = await repo.substituirBookEGravarFotos({
      tenantId: tenantA,
      empreendimentoId: empId,
      book: { id: id1, origem: 'pdf', pdfUrl: '/uploads/imoveis/b.pdf', pdfNomeOriginal: 'b.pdf', totalPaginas: 3, paginas: paginas1 },
      fotos: [{ categoria: 'fachada', url: '/uploads/imoveis/foto1.jpg', order: 0 }],
    });
    expect(r1.urlsBookAnterior).toEqual([]);
    const lido = await repo.buscarPorEmpreendimento(tenantA, empId);
    expect(lido).toMatchObject({ id: id1, origem: 'pdf', totalPaginas: 3, pdfNomeOriginal: 'b.pdf' });
    expect(lido!.paginas.map((p) => p.numero)).toEqual([1, 2, 3]);
    expect(await prisma.empreendimentoPhoto.count({ where: { empreendimentoId: empId } })).toBe(1);

    const r2 = await repo.substituirBookEGravarFotos({
      tenantId: tenantA,
      empreendimentoId: empId,
      book: { id: randomUUID(), origem: 'imagens', pdfUrl: null, pdfNomeOriginal: null, totalPaginas: 1, paginas: [pagina(1, 'planta')] },
      fotos: [{ categoria: 'planta', url: '/uploads/imoveis/foto2.jpg', order: 0 }],
    });
    expect(r2.urlsBookAnterior.sort()).toEqual(['/uploads/imoveis/b.pdf', ...paginas1.map((p) => p.url)].sort());
    expect(await prisma.empreendimentoBook.count({ where: { empreendimentoId: empId } })).toBe(1);
    expect(await prisma.empreendimentoBookPagina.count({ where: { bookId: id1 } })).toBe(0); // cascata
    expect(await prisma.empreendimentoPhoto.count({ where: { empreendimentoId: empId } })).toBe(2);
  });

  it('falha no meio (pagina duplicada): nada muda - nem book, nem fotos', async () => {
    const antes = await repo.buscarPorEmpreendimento(tenantA, empId);
    const fotosAntes = await prisma.empreendimentoPhoto.count({ where: { empreendimentoId: empId } });
    await expect(
      repo.substituirBookEGravarFotos({
        tenantId: tenantA,
        empreendimentoId: empId,
        book: {
          id: randomUUID(),
          origem: 'imagens',
          pdfUrl: null,
          pdfNomeOriginal: null,
          totalPaginas: 2,
          paginas: [pagina(1, 'fachada'), pagina(1, 'planta')], // viola @@unique(bookId, numero)
        },
        fotos: [{ categoria: 'fachada', url: '/uploads/imoveis/foto3.jpg', order: 0 }],
      }),
    ).rejects.toThrow();
    expect(await repo.buscarPorEmpreendimento(tenantA, empId)).toEqual(antes);
    expect(await prisma.empreendimentoPhoto.count({ where: { empreendimentoId: empId } })).toBe(fotosAntes);
  });

  it('outro tenant nao le o book; paginas por categoria excluem descartar por padrao', async () => {
    await repo.substituirBookEGravarFotos({
      tenantId: tenantA,
      empreendimentoId: empId,
      book: {
        id: randomUUID(),
        origem: 'imagens',
        pdfUrl: null,
        pdfNomeOriginal: null,
        totalPaginas: 3,
        paginas: [pagina(1, 'fachada'), pagina(2, 'descartar'), pagina(3, 'planta')],
      },
      fotos: [],
    });
    expect(await repo.buscarPorEmpreendimento(tenantB, empId)).toBeNull();
    expect(await repo.listarPaginasPorCategoria(tenantB, empId)).toEqual([]);
    expect((await repo.listarPaginasPorCategoria(tenantA, empId)).map((p) => p.numero)).toEqual([1, 3]);
    expect((await repo.listarPaginasPorCategoria(tenantA, empId, ['descartar'])).map((p) => p.numero)).toEqual([2]);
  });

  it('apagar o empreendimento leva o book e as paginas junto (cascata)', async () => {
    await prisma.empreendimento.delete({ where: { id: empId } });
    expect(await prisma.empreendimentoBook.count({ where: { tenantId: tenantA } })).toBe(0);
    expect(await prisma.empreendimentoBookPagina.count({ where: { tenantId: tenantA } })).toBe(0);
  });
});
