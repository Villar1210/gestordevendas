import { BadRequestException, GoneException } from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { AnalisarBookEmpreendimentoUseCase } from './analisar-book-empreendimento.use-case';
import { ConfirmarBookEmpreendimentoUseCase } from './confirmar-book-empreendimento.use-case';
import { escolherCapa } from '../../domain/services/book-empreendimento';
import { BookTemporario } from '../../domain/services/book-temporario.interface';
import { GravarBookInput } from '../../domain/repositories/empreendimento-book-repository.interface';
import { CanvasImagemBookService } from '../../infra/services/canvas-imagem-book.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const PDF = Buffer.from('%PDF-1.7\nconteudo');

// Texto "bom" (acima do minimo de caracteres): a ficha vai so pelo texto.
const TEXTO_LONGO = 'Ficha tecnica com area do terreno, torres, unidades e itens de lazer. '.repeat(2);

function montar(paginas = 3, texto: (n: number) => string = (n) => `texto ${n} ${TEXTO_LONGO}`) {
  const textos = Array.from({ length: paginas }, (_, i) => ({ numero: i + 1, texto: texto(i + 1) }));
  const pdfReader = {
    contarPaginas: jest.fn(async () => paginas),
    lerTextoPorPagina: jest.fn(async () => ({ totalPaginas: textos.length, paginas: textos.slice(0, 81) })),
    renderizarPaginas: jest.fn(async (_pdf: Buffer, nums: number[]) =>
      nums.map((numero) => ({ numero, jpeg: Buffer.from(`jpg${numero}`), largura: 10, altura: 10 })),
    ),
  };
  const guardados = new Map<string, BookTemporario>();
  const bookStorage = {
    salvar: jest.fn(async (_t: string, book: BookTemporario) => {
      guardados.set('book-1', book);
      return 'book-1';
    }),
    ler: jest.fn(async (t: string, id: string) => (t === TENANT ? guardados.get(id) ?? null : null)),
    remover: jest.fn(async () => undefined),
    travar: jest.fn(async () => async () => undefined),
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
    extrairFichaTecnicaEmpreendimento: jest.fn(async (texto: string, _imagens?: unknown[]) => ({
      nome: null,
      endereco: null,
      descricao: texto.startsWith('[Pagina 2]') ? 'ficha primeiro' : 'ordem errada',
      areaTerreno: 5000,
      totalUnidades: 320,
      numeroTorres: 2,
      unidadesPorAndar: null,
      gabarito: null,
      vagas: null,
      // Texto "completo" (lazer E tipologias): sem segunda chamada com imagens.
      tipologias: [{ nome: '2 dormitórios', areaPrivativa: 45, dormitorios: 2 }] as {
        nome: string;
        areaPrivativa: number | null;
        dormitorios: number | null;
      }[],
      itensLazer: ['Piscina'] as string[],
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
  const fileStorage: {
    upload: jest.Mock;
    download: jest.Mock;
    delete?: jest.Mock;
  } = {
    upload: jest.fn(async (f: { originalname: string }) => ({ url: `/uploads/imoveis/${f.originalname}` })),
    download: jest.fn(async () => Buffer.alloc(0)),
    delete: jest.fn(async () => undefined),
  };
  // Book guardado (Fatia 2): fake em memoria com a mesma semantica da
  // transacao real - substitui o anterior, grava paginas e fotos juntos.
  const booksSalvos = new Map<string, { tenantId: string; book: GravarBookInput['book'] }>();
  const bookRepo = {
    substituirBookEGravarFotos: jest.fn(async (input: GravarBookInput) => {
      const anterior = booksSalvos.get(input.empreendimentoId);
      const urlsBookAnterior = anterior
        ? [...(anterior.book.pdfUrl ? [anterior.book.pdfUrl] : []), ...anterior.book.paginas.map((p) => p.url)]
        : [];
      booksSalvos.set(input.empreendimentoId, { tenantId: input.tenantId, book: input.book });
      for (const f of input.fotos) {
        fotos.push({ tenantId: input.tenantId, empreendimentoId: input.empreendimentoId, ...f } as never);
      }
      return { urlsBookAnterior };
    }),
    buscarPorEmpreendimento: jest.fn(),
    listarPaginasPorCategoria: jest.fn(),
  };
  const criar = { execute: jest.fn(async () => ({ id: 'emp-novo' })) };
  const ficha = { execute: jest.fn(async (_input: Record<string, unknown>) => ({})) };
  const tipologiaRepo = {
    findAllByEmpreendimento: jest.fn(async () => [{ nome: 'Planta antiga', areaPrivativa: 40, dormitorios: 1 }]),
  };

  // Normalizador REAL (@napi-rs/canvas), so espionado.
  const imagemBook = new CanvasImagemBookService();
  jest.spyOn(imagemBook, 'redimensionarJpegs');

  const analisar = new AnalisarBookEmpreendimentoUseCase(
    empRepo as never,
    pdfReader as never,
    bookStorage as never,
    ai as never,
    imagemBook,
  );
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
  return {
    analisar,
    confirmar,
    ai,
    pdfReader,
    bookStorage,
    guardados,
    fotos,
    criar,
    ficha,
    fileStorage,
    empRepo,
    imagemBook,
    bookRepo,
    booksSalvos,
  };
}

const arquivo = (buffer = PDF) => ({ buffer, originalname: 'book.pdf', mimetype: 'application/pdf' });
const pdfs = (buffer = PDF) => [arquivo(buffer)];
const FICHA = { itensLazer: [], tipologias: [] };

// JPEG gerado em teste (nada binario no repositorio): faixa colorida para
// conferir ordem/orientacao. Com "exif", insere um segmento APP1 com
// Orientation e um texto "GPS-SECRETO" (simulando localizacao do celular).
async function gerarJpeg(largura: number, altura: number, cor = '#ff0000', exif?: { orientacao: number }): Promise<Buffer> {
  const canvas = createCanvas(largura, altura);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, largura, altura);
  const jpeg = await canvas.encode('jpeg', 90);
  if (!exif) return jpeg;
  // TIFF big-endian, IFD0 com 1 entrada: Orientation (0x0112), SHORT, valor.
  const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, exif.orientacao, 0, 0, 0, 0, 0, 0]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, Buffer.from('GPS-SECRETO', 'latin1')]);
  const tamanho = payload.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, tamanho >> 8, tamanho & 0xff]), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

// Cabecalho JPEG minimo declarando largura x altura (sem imagem de verdade):
// SOI + SOF0. So serve para testar a recusa ANTES de decodificar.
function jpegSoCabecalho(largura: number, altura: number): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
}

const jpg = (buffer: Buffer, nome = 'pagina.jpg') => ({ buffer, originalname: nome, mimetype: 'image/jpeg' });

async function corDoCentro(jpeg: Buffer): Promise<number[]> {
  const imagem = await loadImage(jpeg);
  const canvas = createCanvas(imagem.width, imagem.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imagem, 0, 0);
  return [...ctx.getImageData(Math.floor(imagem.width / 2), Math.floor(imagem.height / 2), 1, 1).data].slice(0, 3);
}

const NOVO = { name: 'X', rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', cep: '01000-000' };

describe('Book do empreendimento - analisar', () => {
  it('classifica as paginas, le endereco e manda a ficha tecnica primeiro para a IA', async () => {
    const c = montar();
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
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
    await expect(c.analisar.execute({ tenantId: TENANT, arquivos: pdfs(Buffer.from('oi')) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() })).rejects.toThrow('limite é 80');
  });

  it('se a IA falhar, devolve tudo como "descartar" com aviso (nunca inventa)', async () => {
    const c = montar();
    c.ai.classificarPaginasBook.mockRejectedValueOnce(new Error('timeout'));
    c.ai.extrairFichaTecnicaEmpreendimento.mockRejectedValueOnce(new Error('json'));
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    expect(r.paginas.every((p) => p.categoria === 'descartar')).toBe(true);
    expect(r.ficha.areaTerreno).toBeNull();
    expect(r.avisos).toHaveLength(2);
  });

  it('empreendimento de outra empresa: 404', async () => {
    const c = montar();
    await expect(
      c.analisar.execute({ tenantId: TENANT, empreendimentoId: 'emp-de-outro', arquivos: pdfs() }),
    ).rejects.toThrow('não encontrado');
  });
});

describe('Book do empreendimento - confirmar', () => {
  it('cria o empreendimento novo e salva so paginas de foto, continuando a ordem existente', async () => {
    const c = montar();
    await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
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
    expect(r).toEqual({ empreendimentoId: 'emp-novo', fotosCriadas: 2, paginasNoBook: 3 });
    expect(c.fotos).toEqual([
      { tenantId: TENANT, empreendimentoId: 'emp-novo', categoria: 'fachada', url: '/uploads/imoveis/book-pagina-1.jpg', order: 0 },
      { tenantId: TENANT, empreendimentoId: 'emp-novo', categoria: 'area_comum', url: '/uploads/imoveis/book-pagina-3.jpg', order: 2 },
    ]);
    // Fatia 2: renderiza TODAS as paginas (book completo), uma vez so - as
    // fotos reaproveitam as mesmas imagens.
    expect(c.pdfReader.renderizarPaginas).toHaveBeenLastCalledWith(expect.any(Buffer), [1, 2, 3], {
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
    await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
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
    await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    c.bookRepo.substituirBookEGravarFotos.mockRejectedValueOnce(new Error('banco caiu'));
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

describe('Book do empreendimento - analisar imagens JPG', () => {
  it('3 JPGs viram paginas 1..3 na ordem de envio, normalizadas e guardadas como "imagens"', async () => {
    const c = montar();
    const arquivos = [
      jpg(await gerarJpeg(2000, 1000, '#ff0000'), 'c.jpg'),
      jpg(await gerarJpeg(800, 600, '#00ff00'), 'a.jpg'),
      jpg(await gerarJpeg(1000, 1000, '#0000ff'), 'b.jpeg'),
    ];
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos });
    expect(r.origem).toBe('imagens');
    expect(r.totalPaginas).toBe(3);
    // nunca le/renderiza PDF
    expect(c.pdfReader.lerTextoPorPagina).not.toHaveBeenCalled();
    expect(c.pdfReader.renderizarPaginas).not.toHaveBeenCalled();
    // classificacao: texto vazio + miniatura de cada pagina, na ordem
    const enviadas = (c.ai.classificarPaginasBook.mock.calls[0] as unknown as [{ numero: number; texto: string; imagemJpegBase64: string | null }[]])[0];
    expect(enviadas.map((p) => p.numero)).toEqual([1, 2, 3]);
    expect(enviadas.every((p) => p.texto === '' && !!p.imagemJpegBase64)).toBe(true);
    const mini1 = await loadImage(Buffer.from(enviadas[0].imagemJpegBase64!, 'base64'));
    expect(mini1.width).toBe(480);

    const guardado = c.guardados.get('book-1');
    expect(guardado?.origem).toBe('imagens');
    const imagens = guardado?.origem === 'imagens' ? guardado.imagens : [];
    expect(imagens).toHaveLength(3);
    // 2000 px -> 1600 (mantem proporcao); 800 px nao e ampliada
    const [p1, p2] = await Promise.all([loadImage(imagens[0]), loadImage(imagens[1])]);
    expect([p1.width, p1.height]).toEqual([1600, 800]);
    expect([p2.width, p2.height]).toEqual([800, 600]);
    // ordem preservada (cor de cada pagina)
    const cores = await Promise.all(imagens.map(corDoCentro));
    expect(cores[0][0]).toBeGreaterThan(200);
    expect(cores[1][1]).toBeGreaterThan(200);
    expect(cores[2][2]).toBeGreaterThan(200);
  });

  it('ficha tecnica e lida pelas IMAGENS, priorizando ficha_tecnica, planta, area_comum, localizacao, fachada', async () => {
    const c = montar();
    c.ai.classificarPaginasBook.mockResolvedValueOnce({
      paginas: [
        { numero: 1, categoria: 'fachada', legenda: null },
        { numero: 2, categoria: 'descartar', legenda: null },
        { numero: 3, categoria: 'planta', legenda: null },
        { numero: 4, categoria: 'ficha_tecnica', legenda: null },
      ],
      nome: null,
      construtora: null,
      endereco: { rua: null, numero: null, bairro: null, cidade: null, uf: null, cep: null },
    } as never);
    const arquivos = await Promise.all([1, 2, 3, 4].map(async () => jpg(await gerarJpeg(1200, 900))));
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos });
    const [, imagens] = c.ai.extrairFichaTecnicaEmpreendimento.mock.calls[0] as unknown as [string, { numero: number; imagemJpegBase64: string }[]];
    expect(imagens.map((i) => i.numero)).toEqual([4, 3, 1]);
    const img = await loadImage(Buffer.from(imagens[0].imagemJpegBase64, 'base64'));
    expect(img.width).toBe(1000);
    expect(r.avisos).toEqual([]);
  });

  it('remove o EXIF (localizacao) e respeita a orientacao da foto do celular', async () => {
    const c = montar();
    // 400x200 com Orientation=6 (girar 90 graus): a foto "em pe" e 200x400
    const original = await gerarJpeg(400, 200, '#ff0000', { orientacao: 6 });
    expect(original.includes(Buffer.from('GPS-SECRETO'))).toBe(true);
    await c.analisar.execute({ tenantId: TENANT, arquivos: [jpg(original)] });
    const guardado = c.guardados.get('book-1');
    const jpeg = guardado?.origem === 'imagens' ? guardado.imagens[0] : Buffer.alloc(0);
    expect(jpeg.includes(Buffer.from('GPS-SECRETO'))).toBe(false);
    expect(jpeg.includes(Buffer.from('Exif'))).toBe(false);
    const img = await loadImage(jpeg);
    expect([img.width, img.height]).toEqual([200, 400]);
  });

  it('arquivo .jpg que na verdade e PNG ou texto: 400', async () => {
    const c = montar();
    const png = await createCanvas(10, 10).encode('png');
    await expect(c.analisar.execute({ tenantId: TENANT, arquivos: [jpg(png, 'foto.jpg')] })).rejects.toThrow(
      'Envie um PDF ou imagens JPG/JPEG.',
    );
    await expect(
      c.analisar.execute({ tenantId: TENANT, arquivos: [jpg(await gerarJpeg(10, 10)), jpg(Buffer.from('ola'), 'b.jpg')] }),
    ).rejects.toThrow('nº 2 não é PDF nem JPG/JPEG');
    expect(c.bookStorage.salvar).not.toHaveBeenCalled();
  });

  it('PDF junto com JPG: 400; 2 PDFs: 400', async () => {
    const c = montar();
    await expect(
      c.analisar.execute({ tenantId: TENANT, arquivos: [arquivo(), jpg(await gerarJpeg(10, 10))] }),
    ).rejects.toThrow('Não misture PDF com imagens');
    await expect(c.analisar.execute({ tenantId: TENANT, arquivos: [arquivo(), arquivo()] })).rejects.toThrow(
      'apenas 1 PDF',
    );
    await expect(c.analisar.execute({ tenantId: TENANT, arquivos: [] })).rejects.toBeInstanceOf(BadRequestException);
    expect(c.pdfReader.lerTextoPorPagina).not.toHaveBeenCalled();
  });

  it('imagem acima do limite de megapixels: 400 SEM decodificar', async () => {
    const c = montar();
    const enorme = jpegSoCabecalho(10000, 6000); // 60 MP declarados no cabecalho
    await expect(c.analisar.execute({ tenantId: TENANT, arquivos: [jpg(enorme)] })).rejects.toThrow(
      'resolução alta demais',
    );
    expect(c.imagemBook.redimensionarJpegs).not.toHaveBeenCalled();
  });

  it('mais de 80 imagens ou imagem acima de 20 MB: 400', async () => {
    const c = montar();
    const pequena = jpg(await gerarJpeg(10, 10));
    await expect(
      c.analisar.execute({ tenantId: TENANT, arquivos: Array.from({ length: 81 }, () => pequena) }),
    ).rejects.toThrow('no máximo 80 imagens');
    const grande = jpg(Buffer.concat([jpegSoCabecalho(100, 100), Buffer.alloc(21 * 1024 * 1024)]));
    await expect(c.analisar.execute({ tenantId: TENANT, arquivos: [grande] })).rejects.toThrow('passa de 20 MB');
    expect(c.imagemBook.redimensionarJpegs).not.toHaveBeenCalled();
  });
});

describe('Book do empreendimento - ficha de PDF com e sem texto', () => {
  it('PDF com texto bom: ficha so pelo texto (sem imagens)', async () => {
    const c = montar();
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    expect(r.origem).toBe('pdf');
    expect(c.ai.extrairFichaTecnicaEmpreendimento).toHaveBeenCalledTimes(1);
    expect(c.ai.extrairFichaTecnicaEmpreendimento.mock.calls[0]).toHaveLength(1);
    // so renderizou as miniaturas da classificacao
    expect(c.pdfReader.renderizarPaginas).toHaveBeenCalledTimes(1);
  });

  it('PDF sem texto: ficha lida pelas imagens das paginas (1000 px, q70), com aviso', async () => {
    const c = montar(3, () => '');
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    expect(c.pdfReader.renderizarPaginas).toHaveBeenLastCalledWith(PDF, [2, 3, 1], {
      larguraPx: 1000,
      qualidadeJpeg: 70,
    });
    const [texto, imagens] = c.ai.extrairFichaTecnicaEmpreendimento.mock.calls[0] as unknown as [string, { numero: number }[]];
    expect(texto).toBe('');
    expect(imagens.map((i) => i.numero)).toEqual([2, 3, 1]);
    expect(r.avisos).toEqual([expect.stringContaining('pouco ou nenhum texto')]);
    expect(r.ficha.areaTerreno).toBe(5000);
  });

  it('PDF sem texto e IA da ficha falhando: aviso + ficha vazia, analise continua', async () => {
    const c = montar(3, () => ' ');
    c.ai.extrairFichaTecnicaEmpreendimento.mockRejectedValueOnce(new Error('timeout'));
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    expect(r.ficha.areaTerreno).toBeNull();
    expect(r.bookId).toBe('book-1');
    expect(r.avisos).toContain('Não foi possível ler a ficha técnica automaticamente. Preencha os campos abaixo.');
  });
});

describe('Book do empreendimento - confirmar book de imagens', () => {
  it('grava as fotos a partir dos JPEGs guardados, sem chamar renderizarPaginas', async () => {
    const c = montar();
    const arquivos = await Promise.all(['#ff0000', '#00ff00', '#0000ff'].map(async (cor) => jpg(await gerarJpeg(300, 200, cor))));
    await c.analisar.execute({ tenantId: TENANT, arquivos });
    const r = await c.confirmar.execute({
      tenantId: TENANT,
      bookId: 'book-1',
      novo: NOVO,
      ficha: FICHA,
      paginas: [
        { numero: 1, categoria: 'fachada' },
        { numero: 2, categoria: 'ficha_tecnica' },
        { numero: 3, categoria: 'area_comum' },
        { numero: 9, categoria: 'planta' }, // pagina que nao existe: ignorada
      ],
    });
    expect(r).toEqual({ empreendimentoId: 'emp-novo', fotosCriadas: 2, paginasNoBook: 3 });
    expect(c.pdfReader.renderizarPaginas).not.toHaveBeenCalled();
    const enviados = c.fileStorage.upload.mock.calls
      .map((call) => (call as unknown as [{ buffer: Buffer; originalname: string }])[0])
      .filter((e) => e.originalname.startsWith('book-pagina-'));
    expect(enviados.map((e) => e.originalname)).toEqual(['book-pagina-1.jpg', 'book-pagina-3.jpg']);
    const guardado = c.guardados.get('book-1');
    const imagens = guardado?.origem === 'imagens' ? guardado.imagens : [];
    expect(enviados[0].buffer).toBe(imagens[0]);
    expect(enviados[1].buffer).toBe(imagens[2]);
    expect(c.fotos.map((f) => f.categoria)).toEqual(['fachada', 'area_comum']);
    expect(c.bookStorage.remover).toHaveBeenCalledWith(TENANT, 'book-1');
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

describe('Book do empreendimento - revisao de seguranca (A2, A1)', () => {
  it('A2: imagem com proporcao extrema (1000 x 49.000 ou 9 x 1) e recusada SEM decodificar', async () => {
    const c = montar();
    for (const [l, a] of [[1000, 49_000], [9000, 1000]]) {
      await expect(c.analisar.execute({ tenantId: TENANT, arquivos: [jpg(jpegSoCabecalho(l, a))] })).rejects.toThrow(
        'A imagem nº 1 tem proporção extrema. Envie uma página por imagem.',
      );
    }
    expect(c.imagemBook.redimensionarJpegs).not.toHaveBeenCalled();
  });

  it('A2: imagem alta (dentro do limite) e reduzida pela ALTURA (max 1600 x 2560)', async () => {
    const c = montar();
    // 1000 x 7000 (proporcao 7, aceita): pela largura nao reduziria nada.
    await c.analisar.execute({ tenantId: TENANT, arquivos: [jpg(await gerarJpeg(1000, 7000))] });
    const guardado = c.guardados.get('book-1');
    const img = await loadImage(guardado?.origem === 'imagens' ? guardado.imagens[0] : Buffer.alloc(0));
    expect(img.height).toBe(2560);
    expect(img.width).toBe(366); // 1000 * 2560 / 7000, arredondado
  });

  it('A1: PDF com mais de 80 paginas e recusado pelo TOTAL do documento, lendo so 81', async () => {
    const c = montar(3);
    const primeiras = Array.from({ length: 81 }, (_, i) => ({ numero: i + 1, texto: 'x' }));
    c.pdfReader.lerTextoPorPagina.mockResolvedValueOnce({ totalPaginas: 100_000, paginas: primeiras } as never);
    await expect(c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() })).rejects.toThrow(
      'O PDF tem 100000 páginas; o limite é 80.',
    );
    expect(c.pdfReader.lerTextoPorPagina).toHaveBeenLastCalledWith(PDF, { maxPaginas: 81 });
    expect(c.pdfReader.renderizarPaginas).not.toHaveBeenCalled();
  });
});

describe('Book do empreendimento - PDF com texto sem lazer/plantas (caso "Terrasse")', () => {
  const ENDERECO_NULO = { rua: null, numero: null, bairro: null, cidade: null, uf: null, cep: null };
  const CLASSIFICACAO_TERRASSE = {
    paginas: [
      { numero: 1, categoria: 'descartar', legenda: null },
      { numero: 2, categoria: 'area_comum', legenda: 'Piscina área comum' },
      { numero: 3, categoria: 'area_comum', legenda: 'Quadra esporte área comum' },
      { numero: 4, categoria: 'planta', legenda: 'Planta 2 dormitórios 60,30m2' },
      { numero: 5, categoria: 'planta', legenda: 'Implantação terreno áreas comuns' },
      { numero: 6, categoria: 'ficha_tecnica', legenda: null },
      { numero: 7, categoria: 'fachada', legenda: 'Fachada' },
      { numero: 8, categoria: 'area_comum', legenda: 'Piscina - área comum' },
      { numero: 9, categoria: 'planta', legenda: 'Planta terreo garden 50,62m2' },
    ],
    nome: 'Terrasse',
    construtora: null,
    endereco: ENDERECO_NULO,
  };
  // Texto so com o institucional: sem lazer, sem tipologias, sem numeros.
  const FICHA_TEXTO = {
    nome: 'Terrasse',
    endereco: null,
    descricao: 'Apartamentos com terraço gourmet',
    areaTerreno: null,
    totalUnidades: null,
    numeroTorres: null,
    unidadesPorAndar: null,
    gabarito: null,
    vagas: 120,
    tipologias: [],
    itensLazer: [],
  };
  const FICHA_VISAO = {
    nome: 'Outro nome',
    endereco: 'Rua da imagem, 10',
    descricao: 'Descrição vinda da imagem',
    areaTerreno: 4200,
    totalUnidades: 280,
    numeroTorres: 2,
    unidadesPorAndar: 8,
    gabarito: null,
    vagas: 999,
    tipologias: [{ nome: 'Tipo 2 dorms', areaPrivativa: 60.3, dormitorios: 2 }],
    itensLazer: ['Piscina', 'Quadra esportiva', 'Adega wine bar'],
  };

  function montarTerrasse(paginas = 9) {
    const c = montar(paginas);
    c.ai.classificarPaginasBook.mockResolvedValueOnce(CLASSIFICACAO_TERRASSE as never);
    c.ai.extrairFichaTecnicaEmpreendimento.mockResolvedValueOnce(FICHA_TEXTO as never);
    return c;
  }

  it('faz UMA segunda chamada com as imagens (ficha, planta, lazer) e mescla: o texto prevalece', async () => {
    const c = montarTerrasse();
    c.ai.extrairFichaTecnicaEmpreendimento.mockResolvedValueOnce(FICHA_VISAO as never);
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });

    expect(c.ai.extrairFichaTecnicaEmpreendimento).toHaveBeenCalledTimes(2);
    // 1a chamada: so texto (como antes)
    expect(c.ai.extrairFichaTecnicaEmpreendimento.mock.calls[0]).toHaveLength(1);
    // 2a chamada: imagens das paginas ficha_tecnica, planta, area_comum (nessa ordem)
    const [texto2, imagens] = c.ai.extrairFichaTecnicaEmpreendimento.mock.calls[1] as unknown as [string, { numero: number }[]];
    expect(texto2).toBe('');
    expect(imagens.map((i) => i.numero)).toEqual([6, 4, 5, 9, 2, 3, 8]);
    expect(c.pdfReader.renderizarPaginas).toHaveBeenLastCalledWith(PDF, [6, 4, 5, 9, 2, 3, 8], {
      larguraPx: 1000,
      qualidadeJpeg: 70,
    });

    // campos do texto prevalecem
    expect(r.ficha.nome).toBe('Terrasse');
    expect(r.ficha.descricao).toBe('Apartamentos com terraço gourmet');
    expect(r.ficha.vagas).toBe(120);
    // campos vazios do texto preenchidos pela visao
    expect(r.ficha.endereco).toBe('Rua da imagem, 10');
    expect(r.ficha.areaTerreno).toBe(4200);
    expect(r.ficha.totalUnidades).toBe(280);
    expect(r.ficha.numeroTorres).toBe(2);
    expect(r.ficha.gabarito).toBeNull();
    expect(r.ficha.itensLazer).toEqual(['Piscina', 'Quadra esportiva', 'Adega wine bar']);
    expect(r.ficha.tipologias).toEqual([{ nome: 'Tipo 2 dorms', areaPrivativa: 60.3, dormitorios: 2 }]);
    // veio da IA: sem aviso de "sugerido pelas legendas"
    expect(r.avisos).toEqual([]);
  });

  it('no maximo 10 imagens na segunda chamada', async () => {
    const c = montar(20);
    c.ai.classificarPaginasBook.mockResolvedValueOnce({
      ...CLASSIFICACAO_TERRASSE,
      paginas: Array.from({ length: 20 }, (_, i) => ({ numero: i + 1, categoria: 'area_comum', legenda: null })),
    } as never);
    c.ai.extrairFichaTecnicaEmpreendimento.mockResolvedValueOnce(FICHA_TEXTO as never);
    await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    const [, imagens] = c.ai.extrairFichaTecnicaEmpreendimento.mock.calls[1] as unknown as [string, unknown[]];
    expect(imagens).toHaveLength(10);
  });

  it('texto ja trouxe lazer E tipologias (e numeros): sem segunda chamada', async () => {
    const c = montar(9);
    c.ai.classificarPaginasBook.mockResolvedValueOnce(CLASSIFICACAO_TERRASSE as never);
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    expect(c.ai.extrairFichaTecnicaEmpreendimento).toHaveBeenCalledTimes(1);
    expect(c.pdfReader.renderizarPaginas).toHaveBeenCalledTimes(1); // so as miniaturas
    expect(r.ficha.itensLazer).toEqual(['Piscina']);
    expect(r.avisos).toEqual([]);
  });

  it('sem paginas de ficha/planta/lazer: sem segunda chamada', async () => {
    const c = montar(3);
    c.ai.classificarPaginasBook.mockResolvedValueOnce({
      ...CLASSIFICACAO_TERRASSE,
      paginas: [1, 2, 3].map((numero) => ({ numero, categoria: 'fachada', legenda: null })),
    } as never);
    c.ai.extrairFichaTecnicaEmpreendimento.mockResolvedValueOnce(FICHA_TEXTO as never);
    await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    expect(c.ai.extrairFichaTecnicaEmpreendimento).toHaveBeenCalledTimes(1);
  });

  it('segunda chamada falha: mantem o texto e sugere lazer/plantas pelas legendas', async () => {
    const c = montarTerrasse();
    c.ai.extrairFichaTecnicaEmpreendimento.mockRejectedValueOnce(new Error('timeout'));
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    expect(c.ai.extrairFichaTecnicaEmpreendimento).toHaveBeenCalledTimes(2);
    expect(r.bookId).toBe('book-1');
    expect(r.ficha.descricao).toBe('Apartamentos com terraço gourmet');
    expect(r.ficha.vagas).toBe(120);
    expect(r.ficha.areaTerreno).toBeNull();
    // legendas: lazer limpo e deduplicado
    expect(r.ficha.itensLazer).toEqual(['Piscina', 'Quadra esporte']);
    // implantacao/terreno ignorada; metragem com virgula vira numero
    expect(r.ficha.tipologias).toEqual([
      { nome: 'Planta 2 dormitórios 60,30m2', areaPrivativa: 60.3, dormitorios: 2 },
      { nome: 'Planta terreo garden 50,62m2', areaPrivativa: 50.62, dormitorios: null },
    ]);
    expect(r.avisos).toEqual([
      'Lazer e plantas foram sugeridos a partir das imagens das páginas. Confira antes de salvar.',
    ]);
    // nao e o aviso de falha geral da ficha
    expect(r.avisos.join(' ')).not.toContain('Não foi possível ler a ficha técnica');
  });

  it('visao tambem nao acha lazer: so o lazer vem das legendas (tipologias da visao ficam)', async () => {
    const c = montarTerrasse();
    c.ai.extrairFichaTecnicaEmpreendimento.mockResolvedValueOnce({ ...FICHA_VISAO, itensLazer: [] } as never);
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos: pdfs() });
    expect(r.ficha.itensLazer).toEqual(['Piscina', 'Quadra esporte']);
    expect(r.ficha.tipologias).toEqual(FICHA_VISAO.tipologias);
    expect(r.avisos).toContain('Lazer e plantas foram sugeridos a partir das imagens das páginas. Confira antes de salvar.');
  });

  it('book de imagens: nao faz segunda chamada (ficha ja foi pelas imagens), mas usa as legendas', async () => {
    const c = montar();
    c.ai.classificarPaginasBook.mockResolvedValueOnce({
      ...CLASSIFICACAO_TERRASSE,
      paginas: CLASSIFICACAO_TERRASSE.paginas.slice(0, 4),
    } as never);
    c.ai.extrairFichaTecnicaEmpreendimento.mockResolvedValueOnce(FICHA_TEXTO as never);
    const arquivos = await Promise.all([1, 2, 3, 4].map(async () => jpg(await gerarJpeg(100, 100))));
    const r = await c.analisar.execute({ tenantId: TENANT, arquivos });
    expect(c.ai.extrairFichaTecnicaEmpreendimento).toHaveBeenCalledTimes(1);
    expect(r.ficha.itensLazer).toEqual(['Piscina', 'Quadra esporte']);
    expect(r.ficha.tipologias).toEqual([{ nome: 'Planta 2 dormitórios 60,30m2', areaPrivativa: 60.3, dormitorios: 2 }]);
  });
});
