// Lote nas ferramentas 1 arquivo -> 1 arquivo: 1 vs varios, nomes
// duplicados, erro nomeando o arquivo, limites e "pages" com varios.
import { CompressPdfUseCase } from './compress-pdf.use-case';
import { OfficeToPdfUseCase } from './office-to-pdf.use-case';
import { RotatePdfUseCase } from './rotate-pdf.use-case';
import { AddPageNumbersUseCase } from './add-page-numbers.use-case';
import { AddWatermarkUseCase } from './add-watermark.use-case';
import { ProtectPdfUseCase } from './protect-pdf.use-case';
import { UnlockPdfUseCase } from './unlock-pdf.use-case';
import { ExtractTextUseCase } from './extract-text.use-case';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfCompressor } from '../../domain/services/pdf-compressor.interface';
import { IOfficeConverter } from '../../domain/services/office-converter.interface';
import { IPdfSecurity } from '../../domain/services/pdf-security.interface';
import { IPdfTextExtractor } from '../../domain/services/pdf-text-extractor.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { availabilityMock, batchMock, engineMock, expectToolError, pdfFile, zipMock } from './pdf-tools.mocks.spec';

type ZipCall = { name: string; data: Buffer }[];
const avail = () => availabilityMock() as unknown as IToolAvailability;
const many = (n: number) => Array.from({ length: n }, (_, i) => pdfFile(`${i}.pdf`));

function entryNames(zip: ReturnType<typeof zipMock>): string[] {
  return (zip.build.mock.calls[0][0] as ZipCall).map((e) => e.name);
}

describe('CompressPdfUseCase (lote)', () => {
  function setup(sizes: number[]) {
    const engine = engineMock();
    const queue = [...sizes];
    const compressor = { compress: jest.fn(async () => Buffer.alloc(queue.shift() ?? 1)) };
    const zip = zipMock();
    const useCase = new CompressPdfUseCase(
      engine as unknown as IPdfEngine,
      compressor as unknown as IPdfCompressor,
      avail(),
      batchMock(zip),
    );
    return { engine, compressor, zip, useCase };
  }

  it('varios -> comprimidos.zip; o ja otimizado entra com o ORIGINAL; meta com somas', async () => {
    const { zip, useCase } = setup([400, 2000, 100]);
    const big = pdfFile('contrato.pdf', 1000);
    const already = pdfFile('contrato.pdf', 1000); // nome repetido + nao reduz
    const small = pdfFile('planta.pdf', 500);
    const result = await useCase.execute({ files: [big, already, small], options: { level: 'extrema' } });
    expect(result.fileName).toBe('comprimidos.zip');
    expect(result.contentType).toBe('application/zip');
    const entries = zip.build.mock.calls[0][0] as ZipCall;
    expect(entries.map((e) => e.name)).toEqual(['contrato_comprimido.pdf', 'contrato_comprimido (2).pdf', 'planta_comprimido.pdf']);
    expect(entries[1].data).toBe(already.buffer);
    expect(entries.map((e) => e.data.length)).toEqual([400, 1000, 100]);
    expect(result.meta).toEqual({
      files: 3,
      pages: 15,
      originalSize: 2500,
      resultSize: 1500,
      alreadyOptimized: 1,
      level: 'extrema',
    });
  });

  it('1 arquivo continua identico (sem zip, meta antigo)', async () => {
    const { zip, useCase } = setup([400]);
    const result = await useCase.execute({ files: [pdfFile('contrato.pdf', 1000)], options: {} });
    expect(zip.build).not.toHaveBeenCalled();
    expect(result.fileName).toBe('contrato_comprimido.pdf');
    expect(result.meta).toEqual({ pages: 5, originalSize: 1000, resultSize: 400, alreadyOptimized: false, level: 'recomendada' });
  });

  it('PDF protegido no meio do lote: erro nomeia o arquivo e o Ghostscript nao roda para nenhum', async () => {
    const { engine, compressor, useCase } = setup([1, 1, 1]);
    engine.getPageCount
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new PdfToolsError('ENCRYPTED_PDF', 'protegido'))
      .mockResolvedValueOnce(1);
    await expectToolError(
      useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('proposta.pdf'), pdfFile('c.pdf')], options: {} }),
      'ENCRYPTED_PDF',
      /^"proposta\.pdf" está protegido por senha/,
    );
    expect(compressor.compress).not.toHaveBeenCalled();
  });

  it('PDF corrompido no lote -> 400 nomeando o arquivo', async () => {
    const { engine, useCase } = setup([1, 1]);
    engine.getPageCount
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new PdfToolsError('INVALID_INPUT', 'Não foi possível ler o PDF. Verifique se o arquivo não está corrompido.'));
    await expectToolError(
      useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('ruim.pdf')], options: {} }),
      'INVALID_INPUT',
      /Não foi possível ler "ruim\.pdf"/,
    );
  });

  it('limite: 20 ok, 21 -> 400', async () => {
    await expect(setup([]).useCase.execute({ files: many(20), options: {} })).resolves.toBeDefined();
    await expectToolError(setup([]).useCase.execute({ files: many(21), options: {} }), 'INVALID_INPUT', /máximo 20 PDFs/);
  });
});

describe('OfficeToPdfUseCase (lote)', () => {
  function setup() {
    const converter = { convertToPdf: jest.fn(async () => Buffer.from('%PDF-1.7')) };
    const zip = zipMock();
    const useCase = new OfficeToPdfUseCase(
      converter as unknown as IOfficeConverter,
      engineMock() as unknown as IPdfEngine,
      avail(),
      batchMock(zip),
    );
    return { converter, zip, useCase };
  }
  const doc = (name: string) => ({ buffer: Buffer.from('x'), originalname: name });

  it('varios -> convertidos.zip com "<nome>.pdf"; mesmo nome com extensoes diferentes e desambiguado', async () => {
    const { converter, zip, useCase } = setup();
    const result = await useCase.execute({ files: [doc('memorial.docx'), doc('Tabela.xlsx'), doc('memorial.odt')] });
    expect(converter.convertToPdf.mock.calls.map((c) => (c as unknown as [{ extension: string }])[0].extension)).toEqual(['docx', 'xlsx', 'odt']);
    expect(entryNames(zip)).toEqual(['memorial.pdf', 'Tabela.pdf', 'memorial (2).pdf']);
    expect(result.fileName).toBe('convertidos.zip');
    expect(result.meta).toMatchObject({ files: 3, pages: 15, originalSize: 3, resultSize: 24 });
  });

  it('extensao invalida no lote -> 400 nomeando o arquivo, sem converter nenhum', async () => {
    const { converter, useCase } = setup();
    await expectToolError(useCase.execute({ files: [doc('a.docx'), doc('virus.exe')] }), 'INVALID_INPUT', /^"virus\.exe": Formato não suportado/);
    expect(converter.convertToPdf).not.toHaveBeenCalled();
  });

  it('falha do LibreOffice no 2o arquivo aborta o lote nomeando-o', async () => {
    const { converter, useCase } = setup();
    converter.convertToPdf
      .mockResolvedValueOnce(Buffer.from('%PDF-'))
      .mockRejectedValueOnce(new PdfToolsError('PROCESSING_FAILED', 'Não foi possível converter o documento para PDF.'));
    await expectToolError(
      useCase.execute({ files: [doc('a.docx'), doc('b.pptx'), doc('c.xlsx')] }),
      'PROCESSING_FAILED',
      /^"b\.pptx": Não foi possível converter/,
    );
    expect(converter.convertToPdf).toHaveBeenCalledTimes(2);
  });

  it('limite de 10 documentos', async () => {
    const docs = (n: number) => Array.from({ length: n }, (_, i) => doc(`${i}.docx`));
    await expect(setup().useCase.execute({ files: docs(10) })).resolves.toBeDefined();
    await expectToolError(setup().useCase.execute({ files: docs(11) }), 'INVALID_INPUT', 'Envie no máximo 10 documentos por vez.' as unknown as RegExp);
  });
});

describe('RotatePdfUseCase (lote)', () => {
  function setup() {
    const engine = engineMock();
    const zip = zipMock();
    return { engine, zip, useCase: new RotatePdfUseCase(engine as unknown as IPdfEngine, batchMock(zip)) };
  }

  it('varios -> girados.zip, mesmo angulo em todos, todas as paginas', async () => {
    const { engine, zip, useCase } = setup();
    const result = await useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { angle: 270 } });
    expect(engine.rotate.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      [270, null],
      [270, null],
    ]);
    expect(entryNames(zip)).toEqual(['a_girado.pdf', 'b_girado.pdf']);
    expect(result.fileName).toBe('girados.zip');
    expect(result.meta).toMatchObject({ files: 2, pages: 10, rotatedPages: 10 });
  });

  it('"pages" com varios PDFs -> 400 claro, sem girar nada; vazio e ignorado', async () => {
    const { engine, useCase } = setup();
    await expectToolError(
      useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { angle: 90, pages: '1-2' } }),
      'INVALID_INPUT',
      /intervalo de páginas só pode ser usado com 1 PDF/,
    );
    expect(engine.getPageCount).not.toHaveBeenCalled();
    await expect(setup().useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { angle: 90, pages: '  ' } })).resolves.toBeDefined();
  });

  it('limite de 20', async () => {
    await expectToolError(setup().useCase.execute({ files: many(21), options: { angle: 90 } }), 'INVALID_INPUT', /máximo 20/);
  });
});

describe('AddPageNumbersUseCase / AddWatermarkUseCase (lote)', () => {
  it('numeros: mesmas opcoes em todos -> numerados.zip', async () => {
    const engine = engineMock();
    const zip = zipMock();
    const result = await new AddPageNumbersUseCase(engine as unknown as IPdfEngine, batchMock(zip)).execute({
      files: [pdfFile('a.pdf'), pdfFile('A.pdf'), pdfFile('c.pdf')],
      options: { format: 'n-de-total', startAt: 3 },
    });
    expect(engine.addPageNumbers).toHaveBeenCalledTimes(3);
    for (const call of engine.addPageNumbers.mock.calls) expect(call[1]).toMatchObject({ format: 'n-de-total', startAt: 3 });
    expect(entryNames(zip)).toEqual(['a_numerado.pdf', 'A_numerado (2).pdf', 'c_numerado.pdf']);
    expect(result.fileName).toBe('numerados.zip');
    expect(result.meta).toMatchObject({ files: 3, pages: 15 });
  });

  it('marca d\'agua: mesmo texto em todos -> marca_dagua.zip; protegido nomeia o arquivo', async () => {
    const engine = engineMock();
    const zip = zipMock();
    const useCase = new AddWatermarkUseCase(engine as unknown as IPdfEngine, batchMock(zip));
    const result = await useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { text: ' RASCUNHO ' } });
    expect(engine.addWatermark.mock.calls.map((c) => c[1].text)).toEqual(['RASCUNHO', 'RASCUNHO']);
    expect(entryNames(zip)).toEqual(['a_marca_dagua.pdf', 'b_marca_dagua.pdf']);
    expect(result.fileName).toBe('marca_dagua.zip');

    engine.getPageCount.mockRejectedValueOnce(new PdfToolsError('ENCRYPTED_PDF', 'x'));
    await expectToolError(
      useCase.execute({ files: [pdfFile('senha.pdf'), pdfFile('b.pdf')], options: { text: 'X' } }),
      'ENCRYPTED_PDF',
      /"senha\.pdf"/,
    );
  });
});

describe('ProtectPdfUseCase / UnlockPdfUseCase (lote)', () => {
  function setup() {
    const engine = engineMock();
    const security = {
      protect: jest.fn(async () => Buffer.from('enc')),
      unlock: jest.fn(async () => Buffer.from('dec')),
    };
    const zip = zipMock();
    const batch = batchMock(zip);
    return {
      engine,
      security,
      zip,
      protect: new ProtectPdfUseCase(engine as unknown as IPdfEngine, security as unknown as IPdfSecurity, avail(), batch),
      unlock: new UnlockPdfUseCase(engine as unknown as IPdfEngine, security as unknown as IPdfSecurity, avail(), batch),
    };
  }

  it('protect: mesma senha em todos -> protegidos.zip; senha nunca no meta', async () => {
    const { security, zip, protect } = setup();
    const result = await protect.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { password: 'segredo123' } });
    expect(security.protect).toHaveBeenCalledTimes(2);
    for (const call of security.protect.mock.calls) expect((call as unknown[])[1]).toEqual({ password: 'segredo123', allowPrint: true, allowCopy: false });
    expect(entryNames(zip)).toEqual(['a_protegido.pdf', 'b_protegido.pdf']);
    expect(result.fileName).toBe('protegidos.zip');
    expect(JSON.stringify(result.meta)).not.toContain('segredo123');
  });

  it('protect: um ja protegido no lote -> ENCRYPTED_PDF nomeando, sem proteger nenhum', async () => {
    const { engine, security, protect } = setup();
    engine.getPageCount.mockResolvedValueOnce(1).mockRejectedValueOnce(new PdfToolsError('ENCRYPTED_PDF', 'x'));
    await expectToolError(
      protect.execute({ files: [pdfFile('a.pdf'), pdfFile('ja.pdf')], options: { password: 'abcd' } }),
      'ENCRYPTED_PDF',
      /"ja\.pdf" está protegido/,
    );
    expect(security.protect).not.toHaveBeenCalled();
  });

  it('unlock: mesma senha -> desbloqueados.zip; senha errada em um -> "Senha incorreta para "x.pdf""', async () => {
    const s = setup();
    const result = await s.unlock.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { password: 'abcd' } });
    expect(s.security.unlock.mock.calls.map((c) => (c as unknown[])[1])).toEqual(['abcd', 'abcd']);
    expect(entryNames(s.zip)).toEqual(['a_desbloqueado.pdf', 'b_desbloqueado.pdf']);
    expect(result.fileName).toBe('desbloqueados.zip');

    const t = setup();
    t.security.unlock
      .mockResolvedValueOnce(Buffer.from('dec'))
      .mockRejectedValueOnce(new PdfToolsError('WRONG_PASSWORD', 'Senha incorreta. Confira a senha e tente novamente.'));
    await expectToolError(
      t.unlock.execute({ files: [pdfFile('a.pdf'), pdfFile('x.pdf'), pdfFile('c.pdf')], options: { password: 'errada' } }),
      'WRONG_PASSWORD',
      /^Senha incorreta para "x\.pdf"/,
    );
    expect(t.security.unlock).toHaveBeenCalledTimes(2);
  });

  it('unlock com 1 arquivo mantem a mensagem de sempre', async () => {
    const s = setup();
    s.security.unlock.mockRejectedValueOnce(new PdfToolsError('WRONG_PASSWORD', 'Senha incorreta. Confira a senha e tente novamente.'));
    await expectToolError(s.unlock.execute({ files: [pdfFile('x.pdf')], options: { password: 'e' } }), 'WRONG_PASSWORD', /^Senha incorreta\. Confira/);
  });
});

describe('ExtractTextUseCase (lote)', () => {
  function setup() {
    const engine = engineMock();
    const extractor = {
      extract: jest.fn(async (buf: Buffer) => ({ pages: 1, byPage: [{ page: 1, text: ` texto de ${buf.toString()} ` }] })),
    };
    return {
      engine,
      extractor,
      useCase: new ExtractTextUseCase(engine as unknown as IPdfEngine, extractor as unknown as IPdfTextExtractor, batchMock()),
    };
  }
  const named = (name: string) => ({ buffer: Buffer.from(name), originalname: name });

  it('varios -> { files: [{ name, pages, byPage }] } na ordem, nomes repetidos desambiguados', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ files: [named('a.pdf'), named('b.pdf'), named('a.pdf')] });
    expect(result).toEqual({
      files: [
        { name: 'a.pdf', pages: 1, byPage: [{ page: 1, text: 'texto de a.pdf' }] },
        { name: 'b.pdf', pages: 1, byPage: [{ page: 1, text: 'texto de b.pdf' }] },
        { name: 'a (2).pdf', pages: 1, byPage: [{ page: 1, text: 'texto de a.pdf' }] },
      ],
    });
  });

  it('1 arquivo -> { pages, byPage } (sem "files" e sem o texto duplicado)', async () => {
    const result = await setup().useCase.execute({ files: [named('a.pdf')] });
    expect(result).toEqual({ pages: 1, byPage: [{ page: 1, text: 'texto de a.pdf' }] });
  });

  it('protegido no lote -> erro nomeando, sem extrair nenhum; limite de 20', async () => {
    const { engine, extractor, useCase } = setup();
    engine.getPageCount.mockResolvedValueOnce(1).mockRejectedValueOnce(new PdfToolsError('ENCRYPTED_PDF', 'x'));
    await expectToolError(useCase.execute({ files: [named('a.pdf'), named('s.pdf')] }), 'ENCRYPTED_PDF', /"s\.pdf"/);
    expect(extractor.extract).not.toHaveBeenCalled();
    await expectToolError(setup().useCase.execute({ files: many(21) }), 'INVALID_INPUT', /máximo 20/);
  });
});

describe('Prazo do lote chega aos binarios', () => {
  it('office/compress/protect/unlock em lote repassam timeoutMs (restante do lote); com 1 arquivo, nao', async () => {
    const converter = { convertToPdf: jest.fn(async () => Buffer.from('%PDF-')) };
    const office = new OfficeToPdfUseCase(converter as unknown as IOfficeConverter, engineMock() as unknown as IPdfEngine, avail(), batchMock());
    await office.execute({ files: [{ buffer: Buffer.from('x'), originalname: 'a.docx' }, { buffer: Buffer.from('x'), originalname: 'b.docx' }] });
    for (const call of converter.convertToPdf.mock.calls) {
      const opts = (call as unknown[])[1] as { timeoutMs: number };
      expect(opts.timeoutMs).toBeGreaterThan(0);
      expect(opts.timeoutMs).toBeLessThanOrEqual(240_000);
    }
    await office.execute({ files: [{ buffer: Buffer.from('x'), originalname: 'a.docx' }] });
    expect(converter.convertToPdf.mock.calls[2]).toHaveLength(1);

    const compressor = { compress: jest.fn(async () => Buffer.alloc(1)) };
    const compress = new CompressPdfUseCase(engineMock() as unknown as IPdfEngine, compressor as unknown as IPdfCompressor, avail(), batchMock());
    await compress.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: {} });
    expect((compressor.compress.mock.calls[0] as unknown[])[2]).toEqual({ timeoutMs: expect.any(Number) });
  });
});
