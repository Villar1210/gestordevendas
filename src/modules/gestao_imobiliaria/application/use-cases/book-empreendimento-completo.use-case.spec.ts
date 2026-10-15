// Fatia 2 do book: book COMPLETO guardado no empreendimento (PDF original +
// todas as paginas em JPG com categoria), substituicao do book anterior,
// desfazer em falha e leitura (GET book / ZIP / paginas por categoria).
// Repositorios em memoria (sem banco); a transacao real e coberta por
// prisma-empreendimento-book.repository.integration.spec.ts.
import { BadRequestException, ConflictException, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import { ConfirmarBookEmpreendimentoUseCase } from './confirmar-book-empreendimento.use-case';
import {
  BaixarZipBookEmpreendimentoUseCase,
  BuscarBookEmpreendimentoUseCase,
  ListarPaginasBookPorCategoriaUseCase,
} from './book-empreendimento-leitura.use-case';
import { BookTemporario } from '../../domain/services/book-temporario.interface';
import {
  EmpreendimentoBookRecord,
  GravarBookInput,
} from '../../domain/repositories/empreendimento-book-repository.interface';
import { StoreZipBookService } from '../../infra/services/store-zip-book.service';
import { LocalFileStorageService } from '../../../../shared/infra/services/local-file-storage.service';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  nomePaginaNoZip,
  parsePaginasZip,
  sanitizarNomeArquivoBook,
} from '../../domain/services/book-empreendimento';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OUTRO_TENANT = '22222222-2222-4222-8222-222222222222';
const EMP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PDF = Buffer.from('%PDF-1.7\nbook');
const FICHA = { itensLazer: [], tipologias: [] };
const NOVO = { name: 'Residencial Sol', rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', cep: '01000-000' };

// 5 paginas: fachada, ficha_tecnica, area_comum, descartar, planta.
const CATEGORIAS = [
  { numero: 1, categoria: 'fachada' },
  { numero: 2, categoria: 'ficha_tecnica' },
  { numero: 3, categoria: 'area_comum' },
  { numero: 4, categoria: 'descartar' },
  { numero: 5, categoria: 'planta' },
];

async function jpeg(largura: number, altura: number): Promise<Buffer> {
  const canvas = createCanvas(largura, altura);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#336699';
  ctx.fillRect(0, 0, largura, altura);
  return canvas.encode('jpeg', 80);
}

function montar(opcoes: { totalPaginas?: number; temDelete?: boolean; storageReal?: LocalFileStorageService } = {}) {
  const totalPaginas = opcoes.totalPaginas ?? 5;
  let livro: BookTemporario | null = { origem: 'pdf', pdf: PDF, nomeOriginal: 'Book Sol (final).pdf' };
  const bookStorage = {
    salvar: jest.fn(),
    ler: jest.fn(async (t: string) => (t === TENANT ? livro : null)),
    remover: jest.fn(async () => undefined),
    travar: jest.fn(async (_t: string, _id: string): Promise<() => Promise<void>> => async () => undefined),
  };
  const pdfReader = {
    contarPaginas: jest.fn(async () => totalPaginas),
    lerTextoPorPagina: jest.fn(),
    renderizarPaginas: jest.fn(async (_pdf: Buffer, nums: number[], _opcoes?: { larguraPx: number; qualidadeJpeg: number }) =>
      nums.map((numero) => ({ numero, jpeg: Buffer.from(`jpg-${numero}`), largura: 1600, altura: 1131 })),
    ),
  };
  const enviados: { originalname: string; url: string; buffer: Buffer }[] = [];
  const fileStorage: { upload: jest.Mock; download: jest.Mock; delete?: jest.Mock } = {
    upload: jest.fn(async (f: { originalname: string; buffer: Buffer }) => {
      const url = `/uploads/imoveis/${enviados.length}-${f.originalname}`;
      enviados.push({ originalname: f.originalname, url, buffer: f.buffer });
      return { url };
    }),
    download: jest.fn(async (url: string) => {
      const e = enviados.find((x) => x.url === url);
      if (!e) throw new Error('ENOENT');
      return e.buffer;
    }),
  };
  if (opcoes.temDelete !== false) fileStorage.delete = jest.fn(async () => undefined);
  // Armazenamento REAL em disco (pasta temporaria): upload/delete de verdade,
  // espionados para conferir o que foi enviado/apagado.
  if (opcoes.storageReal) {
    const real = opcoes.storageReal;
    fileStorage.upload = jest.fn(async (f: { originalname: string; buffer: Buffer; mimetype: string }) => {
      const r = await real.upload(f);
      enviados.push({ originalname: f.originalname, url: r.url, buffer: f.buffer });
      return r;
    });
    fileStorage.delete = jest.fn((url: string) => real.delete(url));
  }

  // Banco em memoria: empreendimentos, fotos e books (1 por empreendimento).
  const empreendimentos = new Map<string, { id: string; tenantId: string; name: string }>([
    [EMP, { id: EMP, tenantId: TENANT, name: 'Edifício São João' }],
  ]);
  const fotos: { empreendimentoId: string; categoria: string; url: string; order: number }[] = [];
  const books = new Map<string, EmpreendimentoBookRecord>();
  const empRepo = {
    findByIdAndTenant: jest.fn(async (id: string, t: string) => {
      const e = empreendimentos.get(id);
      return e && e.tenantId === t ? { ...e, description: null, itensLazer: [] } : null;
    }),
    deleteByIdAndTenant: jest.fn(async (id: string, t: string) => {
      if (empreendimentos.get(id)?.tenantId !== t) return;
      empreendimentos.delete(id);
      books.delete(id); // cascata
    }),
    findPhotosByEmpreendimentoAndCategoria: jest.fn(async (id: string, c: string) =>
      fotos.filter((f) => f.empreendimentoId === id && f.categoria === c),
    ),
  };
  const bookRepo = {
    substituirBookEGravarFotos: jest.fn(async (input: GravarBookInput) => {
      const anterior = books.get(input.empreendimentoId);
      const urlsBookAnterior = anterior
        ? [...(anterior.pdfUrl ? [anterior.pdfUrl] : []), ...anterior.paginas.map((p) => p.url)]
        : [];
      books.set(input.empreendimentoId, {
        ...input.book,
        tenantId: input.tenantId,
        empreendimentoId: input.empreendimentoId,
        createdAt: new Date('2026-10-15T12:00:00Z'),
      });
      for (const f of input.fotos) fotos.push({ empreendimentoId: input.empreendimentoId, ...f });
      return { urlsBookAnterior };
    }),
    buscarPorEmpreendimento: jest.fn(async (t: string, id: string) => {
      const b = books.get(id);
      return b && b.tenantId === t ? b : null;
    }),
    listarPaginasPorCategoria: jest.fn(async (t: string, id: string, cats?: readonly string[]) => {
      const b = books.get(id);
      if (!b || b.tenantId !== t) return [];
      return b.paginas.filter((p) => (cats?.length ? cats.includes(p.categoria) : p.categoria !== 'descartar'));
    }),
  };
  const criar = {
    execute: jest.fn(async (input: { tenantId: string; name: string }) => {
      const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      empreendimentos.set(id, { id, tenantId: input.tenantId, name: input.name });
      return { id };
    }),
  };
  const ficha = { execute: jest.fn(async () => ({})) };
  const tipologiaRepo = { findAllByEmpreendimento: jest.fn(async () => []) };

  const confirmar = new ConfirmarBookEmpreendimentoUseCase(
    empRepo as never,
    pdfReader as never,
    bookStorage as never,
    fileStorage as never,
    tipologiaRepo as never,
    bookRepo as never,
    criar as never,
    ficha as never,
  );
  const buscar = new BuscarBookEmpreendimentoUseCase(bookRepo as never);
  const zip = new BaixarZipBookEmpreendimentoUseCase(
    empRepo as never,
    bookRepo as never,
    fileStorage as never,
    new StoreZipBookService(),
  );
  const porCategoria = new ListarPaginasBookPorCategoriaUseCase(bookRepo as never);
  return {
    confirmar,
    buscar,
    zip,
    porCategoria,
    pdfReader,
    bookStorage,
    fileStorage,
    enviados,
    empreendimentos,
    fotos,
    books,
    bookRepo,
    empRepo,
    trocarLivro: (b: BookTemporario | null) => (livro = b),
  };
}

const confirmarExistente = (c: ReturnType<typeof montar>, paginas = CATEGORIAS) =>
  c.confirmar.execute({ tenantId: TENANT, bookId: 'book-1', empreendimentoId: EMP, ficha: FICHA, paginas });

// Le os nomes das entradas de um ZIP pelo central directory (sem biblioteca).
function nomesNoZip(zip: Buffer): string[] {
  const fim = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const total = zip.readUInt16LE(fim + 10);
  let pos = zip.readUInt32LE(fim + 16);
  const nomes: string[] = [];
  for (let i = 0; i < total; i++) {
    const tamanhoNome = zip.readUInt16LE(pos + 28);
    nomes.push(zip.subarray(pos + 46, pos + 46 + tamanhoNome).toString('utf8'));
    pos += 46 + tamanhoNome + zip.readUInt16LE(pos + 30) + zip.readUInt16LE(pos + 32);
  }
  return nomes;
}

describe('Book completo - confirmar PDF', () => {
  it('grava book + TODAS as paginas (inclusive ficha_tecnica e descartar) e as fotos continuam iguais', async () => {
    const c = montar();
    const r = await confirmarExistente(c);
    expect(r).toEqual({ empreendimentoId: EMP, fotosCriadas: 3, paginasNoBook: 5 });

    // Fotos: exatamente como antes (so categorias de foto, arquivos proprios).
    expect(c.fotos.map(({ categoria, order }) => ({ categoria, order }))).toEqual([
      { categoria: 'fachada', order: 0 },
      { categoria: 'area_comum', order: 0 },
      { categoria: 'planta', order: 0 },
    ]);
    expect(c.fotos.map((f) => f.url)).toEqual([
      expect.stringContaining('book-pagina-1.jpg'),
      expect.stringContaining('book-pagina-3.jpg'),
      expect.stringContaining('book-pagina-5.jpg'),
    ]);

    // Book: PDF original + 5 paginas em ordem, com categoria e dimensao.
    const book = c.books.get(EMP)!;
    expect(book.origem).toBe('pdf');
    expect(book.pdfUrl).toMatch(/book-[0-9a-f-]{36}\.pdf$/);
    expect(book.pdfNomeOriginal).toBe('Book Sol (final).pdf');
    expect(book.totalPaginas).toBe(5);
    expect(book.paginas.map((p) => [p.numero, p.categoria])).toEqual([
      [1, 'fachada'],
      [2, 'ficha_tecnica'],
      [3, 'area_comum'],
      [4, 'descartar'],
      [5, 'planta'],
    ]);
    expect(book.paginas.every((p) => p.largura === 1600 && p.altura === 1131)).toBe(true);
    expect(book.paginas[0].url).toMatch(new RegExp(`book-${book.id}-p001\\.jpg$`));

    // Renderiza cada pagina UMA vez (fotos reaproveitam as imagens), 1600 q80.
    const renderizadas = c.pdfReader.renderizarPaginas.mock.calls.flatMap((call) => call[1] as number[]);
    expect(renderizadas).toEqual([1, 2, 3, 4, 5]);
    expect(c.pdfReader.renderizarPaginas.mock.calls[0][2]).toEqual({ larguraPx: 1600, qualidadeJpeg: 80 });

    // A foto e a pagina do book tem o MESMO conteudo, mas arquivos separados.
    const foto1 = c.enviados.find((e) => e.originalname === 'book-pagina-1.jpg')!;
    const pag1 = c.enviados.find((e) => e.originalname.endsWith('-p001.jpg'))!;
    expect(foto1.buffer).toBe(pag1.buffer);
    expect(foto1.url).not.toBe(pag1.url);

    // Nenhum nome de arquivo do usuario no caminho; temporario removido.
    expect(c.enviados.some((e) => e.url.includes('Sol'))).toBe(false);
    expect(c.bookStorage.remover).toHaveBeenCalledWith(TENANT, 'book-1');
    // Primeiro book: nada para apagar.
    expect(c.fileStorage.delete).not.toHaveBeenCalled();
  });

  it('pagina sem categoria informada fica no book como "descartar"', async () => {
    const c = montar();
    await confirmarExistente(c, [{ numero: 1, categoria: 'fachada' }]);
    expect(c.books.get(EMP)!.paginas.map((p) => p.categoria)).toEqual([
      'fachada',
      'descartar',
      'descartar',
      'descartar',
      'descartar',
    ]);
  });

  it('renderiza em lotes de 8 paginas (80 paginas = 10 lotes na fila)', async () => {
    const c = montar({ totalPaginas: 80 });
    const r = await confirmarExistente(c, []);
    expect(r.paginasNoBook).toBe(80);
    expect(c.pdfReader.renderizarPaginas).toHaveBeenCalledTimes(10);
    expect(c.pdfReader.renderizarPaginas.mock.calls.every((call) => (call[1] as number[]).length <= 8)).toBe(true);
  });

  it('render passando do prazo: 503, nada enviado nem gravado', async () => {
    const c = montar({ totalPaginas: 80 });
    const agora = jest.spyOn(Date, 'now');
    let t = 0;
    agora.mockImplementation(() => (t += 60_000)); // cada lote "leva" 1 minuto
    try {
      await expect(confirmarExistente(c, [])).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      agora.mockRestore();
    }
    expect(c.fileStorage.upload).not.toHaveBeenCalled();
    expect(c.bookRepo.substituirBookEGravarFotos).not.toHaveBeenCalled();
    expect(c.bookStorage.remover).not.toHaveBeenCalled(); // pode tentar de novo
  });
});

describe('Book completo - confirmar imagens', () => {
  it('grava book SEM pdfUrl, com as dimensoes reais dos JPEGs e sem renderizar', async () => {
    const c = montar();
    const imagens = await Promise.all([jpeg(1600, 900), jpeg(800, 1200), jpeg(1000, 1000)]);
    c.trocarLivro({ origem: 'imagens', imagens });
    const r = await confirmarExistente(c, [
      { numero: 1, categoria: 'fachada' },
      { numero: 2, categoria: 'descartar' },
      { numero: 3, categoria: 'ficha_tecnica' },
    ]);
    expect(r).toEqual({ empreendimentoId: EMP, fotosCriadas: 1, paginasNoBook: 3 });
    const book = c.books.get(EMP)!;
    expect(book.origem).toBe('imagens');
    expect(book.pdfUrl).toBeNull();
    expect(book.pdfNomeOriginal).toBeNull();
    expect(book.totalPaginas).toBe(3);
    expect(book.paginas.map((p) => [p.numero, p.categoria, p.largura, p.altura])).toEqual([
      [1, 'fachada', 1600, 900],
      [2, 'descartar', 800, 1200],
      [3, 'ficha_tecnica', 1000, 1000],
    ]);
    expect(c.pdfReader.renderizarPaginas).not.toHaveBeenCalled();
    expect(c.pdfReader.contarPaginas).not.toHaveBeenCalled();
    expect(c.enviados.some((e) => e.originalname.endsWith('.pdf'))).toBe(false);
  });
});

describe('Book completo - reimportar', () => {
  it('substitui o book anterior e remove os arquivos antigos DEPOIS do commit', async () => {
    const c = montar();
    await confirmarExistente(c);
    const antigo = c.books.get(EMP)!;
    const urlsAntigas = [antigo.pdfUrl!, ...antigo.paginas.map((p) => p.url)];

    c.trocarLivro({ origem: 'imagens', imagens: [await jpeg(100, 100)] });
    await confirmarExistente(c, [{ numero: 1, categoria: 'fachada' }]);

    const novo = c.books.get(EMP)!;
    expect(novo.id).not.toBe(antigo.id);
    expect(novo.origem).toBe('imagens');
    expect(novo.paginas).toHaveLength(1);
    // Arquivos do book anterior removidos (PDF + 5 paginas), so depois de gravar.
    const apagadas = c.fileStorage.delete!.mock.calls.map((call) => call[0]);
    expect(apagadas.sort()).toEqual(urlsAntigas.sort());
    const ordemGravar = c.bookRepo.substituirBookEGravarFotos.mock.invocationCallOrder[1];
    expect(c.fileStorage.delete!.mock.invocationCallOrder[0]).toBeGreaterThan(ordemGravar);
    // As fotos antigas NAO sao apagadas (o book so acrescenta fotos).
    expect(c.fotos).toHaveLength(4);
  });

  it('armazenamento sem delete: substitui no banco e nao tenta apagar arquivos', async () => {
    const c = montar({ temDelete: false });
    await confirmarExistente(c);
    await expect(confirmarExistente(c)).resolves.toMatchObject({ paginasNoBook: 5 });
    expect(c.bookRepo.substituirBookEGravarFotos).toHaveBeenCalledTimes(2);
  });
});

describe('Book completo - falha no meio', () => {
  it('banco falha: empreendimento NOVO desfeito, sem book, e os arquivos enviados sao removidos', async () => {
    const c = montar();
    c.bookRepo.substituirBookEGravarFotos.mockRejectedValueOnce(new Error('banco caiu'));
    await expect(
      c.confirmar.execute({ tenantId: TENANT, bookId: 'book-1', novo: NOVO, ficha: FICHA, paginas: CATEGORIAS }),
    ).rejects.toThrow('banco caiu');
    const novoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    expect(c.empRepo.deleteByIdAndTenant).toHaveBeenCalledWith(novoId, TENANT);
    expect(c.empreendimentos.has(novoId)).toBe(false);
    expect(c.books.size).toBe(0);
    // 3 fotos + PDF + 5 paginas enviados nesta tentativa -> todos removidos.
    const apagadas = c.fileStorage.delete!.mock.calls.map((call) => call[0]).sort();
    expect(apagadas).toEqual(c.enviados.map((e) => e.url).sort());
    expect(apagadas).toHaveLength(9);
    expect(c.bookStorage.remover).not.toHaveBeenCalled();
  });

  it('upload falha no meio: nada no banco, os ja enviados sao removidos', async () => {
    const c = montar();
    let n = 0;
    const original = c.fileStorage.upload.getMockImplementation()!;
    c.fileStorage.upload.mockImplementation(async (f) => {
      if (++n === 6) throw new Error('disco cheio');
      return original(f);
    });
    await expect(confirmarExistente(c)).rejects.toThrow('disco cheio');
    expect(c.bookRepo.substituirBookEGravarFotos).not.toHaveBeenCalled();
    expect(c.fileStorage.delete!.mock.calls.map((call) => call[0]).sort()).toEqual(c.enviados.map((e) => e.url).sort());
    expect(c.enviados).toHaveLength(5);
  });

  it('book existente falha ao substituir: empreendimento existente NAO e apagado, book anterior fica', async () => {
    const c = montar();
    await confirmarExistente(c);
    const anterior = c.books.get(EMP);
    c.bookRepo.substituirBookEGravarFotos.mockRejectedValueOnce(new Error('deadlock'));
    await expect(confirmarExistente(c)).rejects.toThrow('deadlock');
    expect(c.empRepo.deleteByIdAndTenant).not.toHaveBeenCalled();
    expect(c.books.get(EMP)).toBe(anterior);
    // So os arquivos DESTA tentativa sao removidos, nunca os do book anterior.
    const apagadas = c.fileStorage.delete!.mock.calls.map((call) => call[0]);
    expect(apagadas.some((u) => u === anterior!.pdfUrl)).toBe(false);
  });
});

describe('Book completo - leitura', () => {
  it('GET book: devolve paginas ordenadas; de outra empresa ou sem book = 404', async () => {
    const c = montar();
    await confirmarExistente(c);
    const r = await c.buscar.execute({ tenantId: TENANT, empreendimentoId: EMP });
    expect(r).toMatchObject({ origem: 'pdf', pdfNomeOriginal: 'Book Sol (final).pdf', totalPaginas: 5 });
    expect(r.paginas.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5]);
    expect(Object.keys(r.paginas[0]).sort()).toEqual(['altura', 'categoria', 'largura', 'numero', 'url']);
    await expect(c.buscar.execute({ tenantId: OUTRO_TENANT, empreendimentoId: EMP })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      c.buscar.execute({ tenantId: TENANT, empreendimentoId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ZIP padrao: todas as paginas exceto "descartar", nomes <empreendimento>_pagina_NN.jpg', async () => {
    const c = montar();
    await confirmarExistente(c);
    const r = await c.zip.execute({ tenantId: TENANT, empreendimentoId: EMP });
    expect(r.nomeArquivo).toBe('Edificio_Sao_Joao_book.zip');
    expect(r.quantidade).toBe(4);
    expect(nomesNoZip(r.zip)).toEqual([
      'Edificio_Sao_Joao_pagina_01.jpg',
      'Edificio_Sao_Joao_pagina_02.jpg',
      'Edificio_Sao_Joao_pagina_03.jpg',
      'Edificio_Sao_Joao_pagina_05.jpg',
    ]);
    // Conteudo lido pela url gravada no banco (nunca pela url do usuario).
    expect(r.zip.includes(Buffer.from('jpg-5'))).toBe(true);
    expect(r.zip.includes(Buffer.from('jpg-4'))).toBe(false);
  });

  it('ZIP com ?paginas: so as pedidas (inclusive descartar), em ordem; invalido ou inexistente = 400', async () => {
    const c = montar();
    await confirmarExistente(c);
    const r = await c.zip.execute({ tenantId: TENANT, empreendimentoId: EMP, paginas: '4,1' });
    expect(nomesNoZip(r.zip)).toEqual(['Edificio_Sao_Joao_pagina_01.jpg', 'Edificio_Sao_Joao_pagina_04.jpg']);
    for (const ruim of ['0', '81', '1,1', 'a', '1;2', '../1', '1.5', ['1', '2']]) {
      await expect(c.zip.execute({ tenantId: TENANT, empreendimentoId: EMP, paginas: ruim })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    await expect(c.zip.execute({ tenantId: TENANT, empreendimentoId: EMP, paginas: '6' })).rejects.toThrow(
      'inexistente',
    );
    // parametro invalido nem chega ao banco
    c.bookRepo.buscarPorEmpreendimento.mockClear();
    await expect(c.zip.execute({ tenantId: TENANT, empreendimentoId: EMP, paginas: 'x' })).rejects.toThrow();
    expect(c.bookRepo.buscarPorEmpreendimento).not.toHaveBeenCalled();
  });

  it('ZIP de outra empresa = 404; url fora de /uploads nunca e lida', async () => {
    const c = montar();
    await confirmarExistente(c);
    await expect(c.zip.execute({ tenantId: OUTRO_TENANT, empreendimentoId: EMP })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    c.books.get(EMP)!.paginas[0].url = '/etc/passwd';
    c.fileStorage.download.mockClear();
    await expect(c.zip.execute({ tenantId: TENANT, empreendimentoId: EMP, paginas: '1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(c.fileStorage.download).not.toHaveBeenCalled();
  });

  it('paginas por categoria (para a VIVI): sem filtro exclui descartar; categoria desconhecida = vazio', async () => {
    const c = montar();
    await confirmarExistente(c);
    const todas = await c.porCategoria.execute({ tenantId: TENANT, empreendimentoId: EMP });
    expect(todas.map((p) => p.numero)).toEqual([1, 2, 3, 5]);
    const plantas = await c.porCategoria.execute({ tenantId: TENANT, empreendimentoId: EMP, categorias: ['planta'] });
    expect(plantas.map((p) => p.numero)).toEqual([5]);
    expect(await c.porCategoria.execute({ tenantId: TENANT, empreendimentoId: EMP, categorias: ['xyz'] })).toEqual([]);
    expect(await c.porCategoria.execute({ tenantId: OUTRO_TENANT, empreendimentoId: EMP })).toEqual([]);
  });
});

describe('Book completo - regras puras', () => {
  it('parsePaginasZip', () => {
    expect(parsePaginasZip(undefined)).toEqual({ ok: true, paginas: null });
    expect(parsePaginasZip('')).toEqual({ ok: true, paginas: null });
    expect(parsePaginasZip(' 1, 2 ,80')).toEqual({ ok: true, paginas: [1, 2, 80] });
    expect(parsePaginasZip('1,2,2').ok).toBe(false);
    expect(parsePaginasZip('1,,2').ok).toBe(false);
    expect(parsePaginasZip('-1').ok).toBe(false);
    expect(parsePaginasZip('1e1').ok).toBe(false);
    expect(parsePaginasZip(Array.from({ length: 81 }, (_, i) => (i % 80) + 1).join(',')).ok).toBe(false);
  });

  it('sanitizarNomeArquivoBook: sem pasta, controle ou reservados; limita a 200 mantendo a extensao', () => {
    expect(sanitizarNomeArquivoBook('C:\\Users\\x\\Book Sol.pdf')).toBe('Book Sol.pdf');
    expect(sanitizarNomeArquivoBook('../../etc/pass\u0000wd.pdf')).toBe('passwd.pdf');
    expect(sanitizarNomeArquivoBook('a<b>:"|?*.pdf')).toBe('ab.pdf');
    expect(sanitizarNomeArquivoBook('...')).toBeNull();
    expect(sanitizarNomeArquivoBook(undefined)).toBeNull();
    const longo = sanitizarNomeArquivoBook(`${'x'.repeat(300)}.pdf`)!;
    expect(longo).toHaveLength(200);
    expect(longo.endsWith('.pdf')).toBe(true);
  });

  it('nomePaginaNoZip: sem acento nem separador', () => {
    expect(nomePaginaNoZip('Residencial Água/Clara ../', 7)).toBe('Residencial_Agua_Clara_pagina_07.jpg');
    expect(nomePaginaNoZip('***', 12)).toBe('empreendimento_pagina_12.jpg');
  });
});

// Fim a fim com o LocalFileStorageService REAL (pasta temporaria propria):
// os arquivos do book sao apagados de verdade do disco, as fotos nunca.
class StorageEmPasta extends LocalFileStorageService {
  constructor(pasta: string) {
    super();
    this.pasta = pasta;
  }
}

describe('Book completo - arquivos apagados de verdade (LocalFileStorageService)', () => {
  let raiz: string;
  let pasta: string;

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'gdv-book-disco-'));
    pasta = join(raiz, 'uploads', 'imoveis');
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  const nomeNoDisco = (url: string) => url.slice('/uploads/imoveis/'.length);

  it('reimportar remove do disco os arquivos do book anterior (fotos ficam)', async () => {
    const c = montar({ storageReal: new StorageEmPasta(pasta) });
    await confirmarExistente(c);
    const antigo = c.books.get(EMP)!;
    const arquivosAntigos = [antigo.pdfUrl!, ...antigo.paginas.map((p) => p.url)].map(nomeNoDisco);
    expect(await readdir(pasta)).toHaveLength(9); // 3 fotos + PDF + 5 paginas

    c.trocarLivro({ origem: 'imagens', imagens: [await jpeg(100, 100)] });
    await confirmarExistente(c, [{ numero: 1, categoria: 'fachada' }]);

    const noDisco = await readdir(pasta);
    for (const nome of arquivosAntigos) expect(noDisco).not.toContain(nome);
    const novo = c.books.get(EMP)!;
    expect(noDisco).toContain(nomeNoDisco(novo.paginas[0].url));
    // 4 fotos (3 + 1) continuam; so a pagina do book novo alem delas.
    expect(noDisco.filter((n) => n.includes('book-pagina-'))).toHaveLength(4);
    expect(noDisco).toHaveLength(5);
  });

  it('falha no banco: remove do disco TODOS os arquivos desta tentativa (inclusive fotos)', async () => {
    const c = montar({ storageReal: new StorageEmPasta(pasta) });
    c.bookRepo.substituirBookEGravarFotos.mockRejectedValueOnce(new Error('banco caiu'));
    await expect(
      c.confirmar.execute({ tenantId: TENANT, bookId: 'book-1', novo: NOVO, ficha: FICHA, paginas: CATEGORIAS }),
    ).rejects.toThrow('banco caiu');
    // As fotos da tentativa ("book-pagina-N.jpg") sao recusadas pelo delete
    // (regra de seguranca: so arquivos "book-<uuid>"); os do book saem.
    const sobrou = await readdir(pasta);
    expect(sobrou.every((n) => /-book-pagina-\d+\.jpg$/.test(n))).toBe(true);
    expect(sobrou).toHaveLength(3);
  });

  it('falha ao apagar nao vira erro para o usuario', async () => {
    const c = montar({ storageReal: new StorageEmPasta(pasta) });
    await confirmarExistente(c);
    c.fileStorage.delete!.mockRejectedValue(new Error('EACCES'));
    await expect(confirmarExistente(c)).resolves.toMatchObject({ paginasNoBook: 5 });
  });
});

describe('Book completo - trava, prazo e cancelamento (M2)', () => {
  it('confirmar pega a trava do book e SEMPRE solta (sucesso e erro)', async () => {
    const c = montar();
    const soltar = jest.fn(async () => undefined);
    c.bookStorage.travar.mockImplementation(async () => soltar);
    await confirmarExistente(c);
    expect(c.bookStorage.travar).toHaveBeenCalledWith(TENANT, 'book-1');
    expect(soltar).toHaveBeenCalledTimes(1);

    c.bookRepo.substituirBookEGravarFotos.mockRejectedValueOnce(new Error('banco caiu'));
    await expect(confirmarExistente(c)).rejects.toThrow('banco caiu');
    expect(soltar).toHaveBeenCalledTimes(2);
  });

  it('book ja sendo salvo (trava ocupada): 409 e nada e lido, renderizado ou gravado', async () => {
    const c = montar();
    c.bookStorage.travar.mockRejectedValueOnce(new ConflictException('Este book já está sendo salvo. Aguarde.'));
    await expect(confirmarExistente(c)).rejects.toBeInstanceOf(ConflictException);
    expect(c.bookStorage.ler).not.toHaveBeenCalled();
    expect(c.pdfReader.renderizarPaginas).not.toHaveBeenCalled();
    expect(c.bookRepo.substituirBookEGravarFotos).not.toHaveBeenCalled();
  });

  it('prazo estoura DURANTE o ultimo lote: confere de novo antes dos uploads (503, nada enviado)', async () => {
    const c = montar({ totalPaginas: 8 }); // 1 lote so: a checagem do loop passa
    const agora = jest.spyOn(Date, 'now');
    let t = 0;
    agora.mockImplementation(() => t);
    c.pdfReader.renderizarPaginas.mockImplementation(async (_pdf: Buffer, nums: number[]) => {
      t += 250_000; // o lote "levou" 250 s
      return nums.map((numero) => ({ numero, jpeg: Buffer.from('x'), largura: 1600, altura: 1131 }));
    });
    try {
      await expect(confirmarExistente(c, [])).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      agora.mockRestore();
    }
    expect(c.pdfReader.renderizarPaginas).toHaveBeenCalledTimes(1);
    expect(c.fileStorage.upload).not.toHaveBeenCalled();
  });

  it('cliente fechou a conexao: render para entre lotes, nada enviado', async () => {
    const c = montar({ totalPaginas: 80 });
    const cancelar = new AbortController();
    c.pdfReader.renderizarPaginas.mockImplementation(async (_pdf: Buffer, nums: number[]) => {
      cancelar.abort(); // fecha logo no 1o lote
      return nums.map((numero) => ({ numero, jpeg: Buffer.from('x'), largura: 1600, altura: 1131 }));
    });
    await expect(
      c.confirmar.execute({ tenantId: TENANT, bookId: 'book-1', empreendimentoId: EMP, ficha: FICHA, paginas: [], sinal: cancelar.signal }),
    ).rejects.toThrow('cancelado');
    expect(c.pdfReader.renderizarPaginas).toHaveBeenCalledTimes(1);
    expect(c.fileStorage.upload).not.toHaveBeenCalled();
  });

  it('falha ao apagar loga so o codigo do erro, nunca o caminho', async () => {
    const c = montar();
    await confirmarExistente(c);
    const erro = Object.assign(new Error('EACCES: permission denied, unlink /srv/app/uploads/imoveis/segredo'), {
      code: 'EACCES',
    });
    c.fileStorage.delete!.mockRejectedValue(erro);
    const avisos = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      await confirmarExistente(c);
      const mensagens = avisos.mock.calls.map((call) => String(call[0]));
      expect(mensagens.some((m) => m.includes('EACCES'))).toBe(true);
      expect(mensagens.some((m) => m.includes('/srv/app') || m.includes('uploads'))).toBe(false);
    } finally {
      avisos.mockRestore();
    }
  });
});
