import { BadRequestException, GoneException } from '@nestjs/common';
import { AnalisarBookEmpreendimentoUseCase } from './analisar-book-empreendimento.use-case';
import { ConfirmarBookEmpreendimentoUseCase } from './confirmar-book-empreendimento.use-case';
import { escolherCapa } from '../../domain/services/book-empreendimento';

const TENANT = '11111111-1111-4111-8111-111111111111';
const PDF = Buffer.from('%PDF-1.7\nconteudo');

function montar(paginas = 3) {
  const textos = Array.from({ length: paginas }, (_, i) => ({ numero: i + 1, texto: `texto ${i + 1}` }));
  const pdfReader = {
    lerTextoPorPagina: jest.fn(async () => textos),
    renderizarPaginas: jest.fn(async (_pdf: Buffer, nums: number[]) =>
      nums.map((numero) => ({ numero, jpeg: Buffer.from(`jpg${numero}`), largura: 10, altura: 10 })),
    ),
  };
  const guardados = new Map<string, Buffer>();
  const bookStorage = {
    salvar: jest.fn(async (_t: string, pdf: Buffer) => {
      guardados.set('book-1', pdf);
      return 'book-1';
    }),
    ler: jest.fn(async (t: string, id: string) => (t === TENANT ? guardados.get(id) ?? null : null)),
    remover: jest.fn(async () => undefined),
  };
  const ai = {
    classificarPaginasBook: jest.fn(async () => ({
      paginas: [
        { numero: 1, categoria: 'fachada', legenda: 'Fachada' },
        { numero: 2, categoria: 'ficha_tecnica', legenda: null },
        { numero: 3, categoria: 'area_comum', legenda: 'Piscina' },
      ],
      nome: 'Residencial Teste',
      construtora: 'Construtora X',
      endereco: { rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: null },
    })),
    extrairFichaTecnicaEmpreendimento: jest.fn(async (texto: string) => ({
      nome: null,
      endereco: null,
      descricao: texto.startsWith('[Pagina 2]') ? 'ficha primeiro' : 'ordem errada',
      areaTerreno: 5000,
      totalUnidades: 320,
      numeroTorres: 2,
      unidadesPorAndar: null,
      gabarito: null,
      vagas: null,
      tipologias: [],
      itensLazer: ['Piscina'],
    })),
  };
  const fotos: { categoria: string; url: string; order: number }[] = [];
  const existente = {
    id: 'emp-1',
    description: 'Descrição antiga',
    areaTerreno: 1234,
    totalUnidades: 99,
    numeroTorres: 1,
    unidadesPorAndar: 4,
    gabarito: 10,
    vagas: 50,
    itensLazer: ['Salão de festas'],
  };
  const empRepo = {
    findByIdAndTenant: jest.fn(async (id: string, t: string) => (t === TENANT && id === 'emp-1' ? existente : null)),
    deleteByIdAndTenant: jest.fn(async () => undefined),
    findPhotosByEmpreendimentoAndCategoria: jest.fn(async (_id: string, categoria: string) =>
      categoria === 'area_comum' ? [{}, {}] : [],
    ),
    addPhoto: jest.fn(async (p: { categoria: string; url: string; order: number }) => void fotos.push(p)),
  };
  const fileStorage = { upload: jest.fn(async (f: { originalname: string }) => ({ url: `/uploads/imoveis/${f.originalname}` })) };
  const criar = { execute: jest.fn(async () => ({ id: 'emp-novo' })) };
  const ficha = { execute: jest.fn(async (_input: Record<string, unknown>) => ({})) };
  const tipologiaRepo = {
    findAllByEmpreendimento: jest.fn(async () => [{ nome: 'Planta antiga', areaPrivativa: 40, dormitorios: 1 }]),
  };

  const analisar = new AnalisarBookEmpreendimentoUseCase(
    empRepo as never,
    pdfReader as never,
    bookStorage as never,
    ai as never,
  );
  const confirmar = new ConfirmarBookEmpreendimentoUseCase(
    empRepo as never,
    pdfReader as never,
    bookStorage as never,
    fileStorage as never,
    tipologiaRepo as never,
    criar as never,
    ficha as never,
  );
  return { analisar, confirmar, ai, pdfReader, bookStorage, fotos, criar, ficha, fileStorage, empRepo };
}

const arquivo = (buffer = PDF) => ({ buffer, originalname: 'book.pdf', mimetype: 'application/pdf' });
const FICHA = { itensLazer: [], tipologias: [] };

describe('Book do empreendimento - analisar', () => {
  it('classifica as paginas, le endereco e manda a ficha tecnica primeiro para a IA', async () => {
    const c = montar();
    const r = await c.analisar.execute({ tenantId: TENANT, file: arquivo() });
    expect(r.bookId).toBe('book-1');
    expect(r.paginas.map((p) => p.categoria)).toEqual(['fachada', 'ficha_tecnica', 'area_comum']);
    expect(r.nome).toBe('Residencial Teste');
    expect(r.endereco.uf).toBe('SP');
    expect(r.ficha.descricao).toBe('ficha primeiro');
    expect(r.avisos).toEqual([]);
    // miniaturas pequenas para a IA
    expect(c.pdfReader.renderizarPaginas).toHaveBeenCalledWith(PDF, [1, 2, 3], { larguraPx: 480, qualidadeJpeg: 60 });
  });

  it('rejeita arquivo que nao e PDF e PDF grande demais em paginas', async () => {
    const c = montar(81);
    await expect(c.analisar.execute({ tenantId: TENANT, file: arquivo(Buffer.from('oi')) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(c.analisar.execute({ tenantId: TENANT, file: arquivo() })).rejects.toThrow('limite é 80');
  });

  it('se a IA falhar, devolve tudo como "descartar" com aviso (nunca inventa)', async () => {
    const c = montar();
    c.ai.classificarPaginasBook.mockRejectedValueOnce(new Error('timeout'));
    c.ai.extrairFichaTecnicaEmpreendimento.mockRejectedValueOnce(new Error('json'));
    const r = await c.analisar.execute({ tenantId: TENANT, file: arquivo() });
    expect(r.paginas.every((p) => p.categoria === 'descartar')).toBe(true);
    expect(r.ficha.areaTerreno).toBeNull();
    expect(r.avisos).toHaveLength(2);
  });

  it('empreendimento de outra empresa: 404', async () => {
    const c = montar();
    await expect(
      c.analisar.execute({ tenantId: TENANT, empreendimentoId: 'emp-de-outro', file: arquivo() }),
    ).rejects.toThrow('não encontrado');
  });
});

describe('Book do empreendimento - confirmar', () => {
  it('cria o empreendimento novo e salva so paginas de foto, continuando a ordem existente', async () => {
    const c = montar();
    await c.analisar.execute({ tenantId: TENANT, file: arquivo() });
    const r = await c.confirmar.execute({
      tenantId: TENANT,
      bookId: 'book-1',
      novo: { name: 'Residencial Teste', rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01000-000' },
      ficha: FICHA,
      paginas: [
        { numero: 1, categoria: 'fachada' },
        { numero: 2, categoria: 'ficha_tecnica' },
        { numero: 3, categoria: 'area_comum' },
        { numero: 3, categoria: 'area_comum' },
      ],
    });
    expect(r).toEqual({ empreendimentoId: 'emp-novo', fotosCriadas: 2 });
    expect(c.fotos).toEqual([
      { tenantId: TENANT, empreendimentoId: 'emp-novo', categoria: 'fachada', url: '/uploads/imoveis/book-pagina-1.jpg', order: 0 },
      { tenantId: TENANT, empreendimentoId: 'emp-novo', categoria: 'area_comum', url: '/uploads/imoveis/book-pagina-3.jpg', order: 2 },
    ]);
    expect(c.pdfReader.renderizarPaginas).toHaveBeenLastCalledWith(expect.any(Buffer), [1, 3], {
      larguraPx: 1600,
      qualidadeJpeg: 80,
    });
    expect(c.bookStorage.remover).toHaveBeenCalledWith(TENANT, 'book-1');
  });

  it('analise vencida ou de outra empresa: 410 e nada e criado', async () => {
    const c = montar();
    await expect(
      c.confirmar.execute({ tenantId: TENANT, bookId: 'nao-existe', empreendimentoId: 'emp-1', ficha: FICHA, paginas: [] }),
    ).rejects.toBeInstanceOf(GoneException);
    expect(c.criar.execute).not.toHaveBeenCalled();
    expect(c.ficha.execute).not.toHaveBeenCalled();
  });

  it('exige existente OU novo, nunca os dois', async () => {
    const c = montar();
    await expect(
      c.confirmar.execute({ tenantId: TENANT, bookId: 'book-1', ficha: FICHA, paginas: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Book do empreendimento - confirmar em empreendimento existente', () => {
  it('campo vazio no book mantem o valor ja cadastrado (nao apaga)', async () => {
    const c = montar();
    await c.analisar.execute({ tenantId: TENANT, file: arquivo() });
    await c.confirmar.execute({
      tenantId: TENANT,
      bookId: 'book-1',
      empreendimentoId: 'emp-1',
      ficha: { areaTerreno: 5000, itensLazer: [], tipologias: [] },
      paginas: [],
    });
    expect(c.ficha.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        areaTerreno: 5000,
        descricao: 'Descrição antiga',
        vagas: 50,
        itensLazer: ['Salão de festas'],
        tipologias: [{ nome: 'Planta antiga', areaPrivativa: 40, dormitorios: 1 }],
      }),
    );
    expect(c.criar.execute).not.toHaveBeenCalled();
  });

  it('se gravar as fotos falhar, o empreendimento NOVO e desfeito', async () => {
    const c = montar();
    await c.analisar.execute({ tenantId: TENANT, file: arquivo() });
    (c.empRepo.addPhoto as jest.Mock).mockRejectedValueOnce(new Error('banco caiu'));
    await expect(
      c.confirmar.execute({
        tenantId: TENANT,
        bookId: 'book-1',
        novo: { name: 'X', rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', cep: '01000-000' },
        ficha: FICHA,
        paginas: [{ numero: 1, categoria: 'fachada' }],
      }),
    ).rejects.toThrow('banco caiu');
    expect(c.empRepo.deleteByIdAndTenant).toHaveBeenCalledWith('emp-novo', TENANT);
    // o PDF temporario continua la: o usuario pode tentar de novo
    expect(c.bookStorage.remover).not.toHaveBeenCalled();
  });
});

describe('Capa do empreendimento', () => {
  it('prefere fachada, depois area comum, e a menor ordem', () => {
    expect(
      escolherCapa([
        { categoria: 'planta', order: 0, url: 'p' },
        { categoria: 'area_comum', order: 1, url: 'a1' },
        { categoria: 'area_comum', order: 0, url: 'a0' },
      ])?.url,
    ).toBe('a0');
    expect(escolherCapa([{ categoria: 'planta', order: 0 }, { categoria: 'fachada', order: 3 }])?.categoria).toBe('fachada');
    expect(escolherCapa([])).toBeNull();
  });
});
