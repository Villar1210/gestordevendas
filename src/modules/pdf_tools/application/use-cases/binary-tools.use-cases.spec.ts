import { CompressPdfUseCase } from './compress-pdf.use-case';
import { OfficeToPdfUseCase, officeExtensionOf } from './office-to-pdf.use-case';
import { ProtectPdfUseCase } from './protect-pdf.use-case';
import { UnlockPdfUseCase } from './unlock-pdf.use-case';
import { PdfToImagesUseCase, uniqueFolderNames } from './pdf-to-images.use-case';
import { GetCapabilitiesUseCase } from './get-capabilities.use-case';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfCompressor } from '../../domain/services/pdf-compressor.interface';
import { IOfficeConverter } from '../../domain/services/office-converter.interface';
import { IPdfSecurity } from '../../domain/services/pdf-security.interface';
import { IPdfRasterizer } from '../../domain/services/pdf-rasterizer.interface';
import { IZipBuilder } from '../../domain/services/zip-builder.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { availabilityMock, engineMock, expectToolError, pdfFile, zipMock } from './pdf-tools.mocks.spec';

describe('GetCapabilitiesUseCase', () => {
  it('devolve o mapa de capacidades', async () => {
    const availability = availabilityMock(true);
    const result = await new GetCapabilitiesUseCase(availability as unknown as IToolAvailability).execute();
    expect(result).toEqual({ office: true, compress: true, security: true, raster: true });
  });
});

describe('CompressPdfUseCase', () => {
  function setup(compressedSize: number, available = true) {
    const engine = engineMock();
    const compressor = { compress: jest.fn().mockResolvedValue(Buffer.alloc(compressedSize)) };
    const availability = availabilityMock(available);
    const useCase = new CompressPdfUseCase(
      engine as unknown as IPdfEngine,
      compressor as unknown as IPdfCompressor,
      availability as unknown as IToolAvailability,
    );
    return { engine, compressor, useCase };
  }

  it('devolve o comprimido quando menor', async () => {
    const { compressor, useCase } = setup(400);
    const result = await useCase.execute({ file: pdfFile('contrato.pdf', 1000), options: { level: 'extrema' } });
    expect(compressor.compress).toHaveBeenCalledWith(expect.any(Buffer), 'extrema');
    expect(result.data.length).toBe(400);
    expect(result.fileName).toBe('contrato_comprimido.pdf');
    expect(result.meta).toMatchObject({ originalSize: 1000, resultSize: 400, alreadyOptimized: false });
  });

  it('resultado >= original: devolve o original com alreadyOptimized', async () => {
    const { useCase } = setup(1500);
    const file = pdfFile('contrato.pdf', 1000);
    const result = await useCase.execute({ file, options: {} });
    expect(result.data).toBe(file.buffer);
    expect(result.meta).toMatchObject({ alreadyOptimized: true, resultSize: 1000, level: 'recomendada' });
  });

  it('503 TOOL_UNAVAILABLE sem Ghostscript; nivel invalido -> 400', async () => {
    await expectToolError(setup(1, false).useCase.execute({ file: pdfFile(), options: {} }), 'TOOL_UNAVAILABLE', /Ghostscript/);
    await expectToolError(setup(1).useCase.execute({ file: pdfFile(), options: { level: 'maxima' } }), 'INVALID_INPUT');
  });

  it('PDF protegido nao chega ao Ghostscript', async () => {
    const { engine, compressor, useCase } = setup(1);
    engine.getPageCount.mockRejectedValue(new PdfToolsError('ENCRYPTED_PDF', 'protegido'));
    await expectToolError(useCase.execute({ file: pdfFile(), options: {} }), 'ENCRYPTED_PDF');
    expect(compressor.compress).not.toHaveBeenCalled();
  });
});

describe('OfficeToPdfUseCase', () => {
  function setup(available = true) {
    const converter = { convertToPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7')) };
    const engine = engineMock();
    const useCase = new OfficeToPdfUseCase(
      converter as unknown as IOfficeConverter,
      engine as unknown as IPdfEngine,
      availabilityMock(available) as unknown as IToolAvailability,
    );
    return { converter, useCase };
  }

  it('converte e nomeia pelo arquivo original', async () => {
    const { converter, useCase } = setup();
    const result = await useCase.execute({ file: { buffer: Buffer.from('x'), originalname: 'Proposta Comercial.DOCX' } });
    expect(converter.convertToPdf).toHaveBeenCalledWith({ buffer: expect.any(Buffer), extension: 'docx' });
    expect(result.fileName).toBe('Proposta Comercial.pdf');
    expect(result.meta.pages).toBe(5);
  });

  it('extensao nao suportada -> 400; sem LibreOffice -> 503', async () => {
    await expectToolError(setup().useCase.execute({ file: { buffer: Buffer.from('x'), originalname: 'a.exe' } }), 'INVALID_INPUT');
    await expectToolError(setup(false).useCase.execute({ file: { buffer: Buffer.from('x'), originalname: 'a.odt' } }), 'TOOL_UNAVAILABLE');
  });

  it('officeExtensionOf', () => {
    expect(officeExtensionOf('planilha.xlsx')).toBe('xlsx');
    expect(officeExtensionOf('semextensao')).toBeNull();
  });
});

describe('ProtectPdfUseCase / UnlockPdfUseCase', () => {
  function setup(available = true) {
    const engine = engineMock();
    const security = {
      protect: jest.fn().mockResolvedValue(Buffer.from('enc')),
      unlock: jest.fn().mockResolvedValue(Buffer.from('dec')),
    };
    const availability = availabilityMock(available) as unknown as IToolAvailability;
    return {
      engine,
      security,
      protect: new ProtectPdfUseCase(engine as unknown as IPdfEngine, security as unknown as IPdfSecurity, availability),
      unlock: new UnlockPdfUseCase(engine as unknown as IPdfEngine, security as unknown as IPdfSecurity, availability),
    };
  }

  it('protect: defaults allowPrint=true/allowCopy=false e senha nunca no meta', async () => {
    const { security, protect } = setup();
    const result = await protect.execute({ file: pdfFile(), options: { password: 'segredo123' } });
    expect(security.protect).toHaveBeenCalledWith(expect.any(Buffer), { password: 'segredo123', allowPrint: true, allowCopy: false });
    expect(result.fileName).toBe('contrato_protegido.pdf');
    expect(JSON.stringify(result.meta)).not.toContain('segredo123');
  });

  it('protect: senha 4-64 sem quebra de linha', async () => {
    const { protect } = setup();
    await expectToolError(protect.execute({ file: pdfFile(), options: { password: '123' } }), 'INVALID_INPUT', /entre 4 e 64/);
    await expectToolError(protect.execute({ file: pdfFile(), options: { password: 'x'.repeat(65) } }), 'INVALID_INPUT');
    await expectToolError(protect.execute({ file: pdfFile(), options: { password: 'abc\ndef' } }), 'INVALID_INPUT', /quebras de linha/);
  });

  it('protect: PDF ja protegido -> ENCRYPTED_PDF; sem qpdf -> 503', async () => {
    const s = setup();
    s.engine.getPageCount.mockRejectedValue(new PdfToolsError('ENCRYPTED_PDF', 'x'));
    await expectToolError(s.protect.execute({ file: pdfFile(), options: { password: 'abcd' } }), 'ENCRYPTED_PDF');
    await expectToolError(setup(false).protect.execute({ file: pdfFile(), options: { password: 'abcd' } }), 'TOOL_UNAVAILABLE');
  });

  it('unlock: chama qpdf com a senha e conta paginas do resultado', async () => {
    const { security, engine, unlock } = setup();
    const result = await unlock.execute({ file: pdfFile(), options: { password: 'abcd' } });
    expect(security.unlock).toHaveBeenCalledWith(expect.any(Buffer), 'abcd');
    expect(engine.getPageCount).toHaveBeenCalledWith(Buffer.from('dec'));
    expect(result.fileName).toBe('contrato_desbloqueado.pdf');
  });

  it('unlock: propaga WRONG_PASSWORD e exige o campo password', async () => {
    const s = setup();
    s.security.unlock.mockRejectedValue(new PdfToolsError('WRONG_PASSWORD', 'Senha incorreta.'));
    await expectToolError(s.unlock.execute({ file: pdfFile(), options: { password: 'errada' } }), 'WRONG_PASSWORD');
    await expectToolError(setup().unlock.execute({ file: pdfFile(), options: {} }), 'INVALID_INPUT', /Informe/);
  });
});

describe('PdfToImagesUseCase', () => {
  function setup(pages: number | number[] = 5) {
    const engine = engineMock();
    const counts = Array.isArray(pages) ? [...pages] : null;
    engine.getPageCount.mockImplementation(async () => (counts ? counts.shift() ?? 1 : (pages as number)));
    const rasterizer = {
      render: jest.fn(async (_pdf: Buffer, indices: number[]) => indices.map((i) => ({ page: i + 1, data: Buffer.from(`img${i}`) }))),
    };
    const zip = zipMock();
    const useCase = new PdfToImagesUseCase(
      engine as unknown as IPdfEngine,
      rasterizer as unknown as IPdfRasterizer,
      zip as unknown as IZipBuilder,
      availabilityMock() as unknown as IToolAvailability,
    );
    return { engine, rasterizer, zip, useCase };
  }

  it('1 pagina -> imagem direta', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ files: [pdfFile()], options: { format: 'png', dpi: 72, pages: '2' } });
    expect(result.contentType).toBe('image/png');
    expect(result.fileName).toBe('contrato_pagina_2.png');
    expect(result.meta).toMatchObject({ files: 1, pages: 1 });
  });

  it('varias paginas -> ZIP com nomes ordenaveis (sem pasta)', async () => {
    const { zip, rasterizer, useCase } = setup(12);
    const result = await useCase.execute({ files: [pdfFile()], options: {} });
    expect(rasterizer.render).toHaveBeenCalledWith(expect.any(Buffer), expect.any(Array), { format: 'jpg', dpi: 150 });
    expect(zip.build.mock.calls[0][0][0]).toEqual({ name: 'contrato_pagina_01.jpg', data: expect.any(Buffer) });
    expect(result.contentType).toBe('application/zip');
    expect(result.fileName).toBe('contrato_imagens.zip');
    expect(result.meta.pages).toBe(12);
  });

  it('limites: 100 paginas (15 em 300 DPI) e dpi invalido', async () => {
    await expectToolError(setup(101).useCase.execute({ files: [pdfFile()], options: {} }), 'INVALID_INPUT', /máximo 100/);
    await expectToolError(setup(16).useCase.execute({ files: [pdfFile()], options: { dpi: 300 } }), 'INVALID_INPUT', /300 DPI/);
    await expectToolError(setup().useCase.execute({ files: [pdfFile()], options: { dpi: 96 } }), 'INVALID_INPUT');
  });

  it('lote: ZIP imagens_pdf.zip com uma pasta por PDF', async () => {
    const { zip, rasterizer, useCase } = setup([2, 1, 3]);
    const result = await useCase.execute({
      files: [pdfFile('contrato.pdf'), pdfFile('Planta São Paulo.pdf'), pdfFile('memorial.pdf')],
      options: { format: 'png' },
    });
    expect(rasterizer.render).toHaveBeenCalledTimes(3);
    const entries = zip.build.mock.calls[0][0] as { name: string; folder?: string }[];
    expect(entries.map((e) => `${e.folder}/${e.name}`)).toEqual([
      'contrato/contrato_pagina_1.png',
      'contrato/contrato_pagina_2.png',
      'Planta Sao Paulo/Planta Sao Paulo_pagina_1.png',
      'memorial/memorial_pagina_1.png',
      'memorial/memorial_pagina_2.png',
      'memorial/memorial_pagina_3.png',
    ]);
    expect(result.fileName).toBe('imagens_pdf.zip');
    expect(result.contentType).toBe('application/zip');
    expect(result.meta).toMatchObject({ files: 3, pages: 6, originalPages: 6 });
  });

  it('lote: 2 PDFs de 1 pagina ainda viram ZIP (nunca imagem solta)', async () => {
    const { zip, useCase } = setup([1, 1]);
    const result = await useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: {} });
    expect(result.contentType).toBe('application/zip');
    expect(zip.build.mock.calls[0][0]).toHaveLength(2);
  });

  it('lote: nomes repetidos viram "contrato", "contrato (2)", "contrato (3)"', async () => {
    const { zip, useCase } = setup([1, 1, 1]);
    await useCase.execute({ files: [pdfFile('contrato.pdf'), pdfFile('Contrato.PDF'), pdfFile('contrato.pdf')], options: {} });
    const folders = (zip.build.mock.calls[0][0] as { folder?: string }[]).map((e) => e.folder);
    expect(folders).toEqual(['contrato', 'Contrato (2)', 'contrato (3)']);
    expect(uniqueFolderNames(['x.pdf', 'x.pdf', 'x (2).pdf'])).toEqual(['x', 'x (2)', 'x _2']);
  });

  it('lote: limite de 100 paginas e sobre o TOTAL, validado antes de rasterizar', async () => {
    const { rasterizer, useCase } = setup([60, 41]);
    await expectToolError(
      useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: {} }),
      'INVALID_INPUT',
      /2 PDFs somam 101 páginas.*máximo 100/,
    );
    expect(rasterizer.render).not.toHaveBeenCalled();
    const at300 = setup([8, 8]);
    await expectToolError(
      at300.useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { dpi: 300 } }),
      'INVALID_INPUT',
      /somam 16 páginas.*15 páginas por vez em 300 DPI/,
    );
    expect(at300.rasterizer.render).not.toHaveBeenCalled();
    // exatamente 100 no total passa
    await expect(setup([60, 40]).useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: {} })).resolves.toBeDefined();
  });

  it('lote: intervalo de paginas com varios PDFs -> 400', async () => {
    const { rasterizer, useCase } = setup([2, 2]);
    await expectToolError(
      useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { pages: '1-2' } }),
      'INVALID_INPUT',
      /intervalo de páginas só pode ser usado com 1 PDF/,
    );
    expect(rasterizer.render).not.toHaveBeenCalled();
    // intervalo vazio e ignorado
    await expect(setup([2, 2]).useCase.execute({ files: [pdfFile('a.pdf'), pdfFile('b.pdf')], options: { pages: ' ' } })).resolves.toBeDefined();
  });

  it('lote: PDF protegido -> ENCRYPTED_PDF dizendo QUAL arquivo, sem rasterizar nenhum', async () => {
    const { engine, rasterizer, useCase } = setup();
    engine.getPageCount
      .mockResolvedValueOnce(2)
      .mockRejectedValueOnce(new PdfToolsError('ENCRYPTED_PDF', 'protegido'));
    await expectToolError(
      useCase.execute({ files: [pdfFile('ok.pdf'), pdfFile('senha.pdf')], options: {} }),
      'ENCRYPTED_PDF',
      /"senha\.pdf" está protegido por senha/,
    );
    expect(rasterizer.render).not.toHaveBeenCalled();
  });

  it('quantidade: 0 ou mais de 20 PDFs -> 400', async () => {
    await expectToolError(setup().useCase.execute({ files: [], options: {} }), 'INVALID_INPUT');
    const many = Array.from({ length: 21 }, (_, i) => pdfFile(`${i}.pdf`));
    await expectToolError(setup(1).useCase.execute({ files: many, options: {} }), 'INVALID_INPUT', /máximo 20 PDFs/);
  });
});
