import { MergePdfsUseCase } from './merge-pdfs.use-case';
import { SplitPdfUseCase } from './split-pdf.use-case';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IZipBuilder } from '../../domain/services/zip-builder.interface';
import { engineMock, expectToolError, pdfFile, zipMock } from './pdf-tools.mocks.spec';

describe('MergePdfsUseCase', () => {
  function setup() {
    const engine = engineMock();
    return { engine, useCase: new MergePdfsUseCase(engine as unknown as IPdfEngine) };
  }

  it('junta na ordem enviada e devolve documento_unido.pdf com meta', async () => {
    const { engine, useCase } = setup();
    const files = [pdfFile('a.pdf', 10), pdfFile('b.pdf', 20)];
    const result = await useCase.execute({ files });
    expect(engine.merge).toHaveBeenCalledWith([files[0].buffer, files[1].buffer]);
    expect(result.fileName).toBe('documento_unido.pdf');
    expect(result.contentType).toBe('application/pdf');
    expect(result.meta).toMatchObject({ files: 2, pages: 5, originalSize: 30, resultSize: 6 });
  });

  it('exige de 2 a 20 PDFs', async () => {
    const { useCase } = setup();
    await expectToolError(useCase.execute({ files: [pdfFile()] }), 'INVALID_INPUT', /pelo menos 2/);
    await expectToolError(useCase.execute({ files: Array.from({ length: 21 }, () => pdfFile()) }), 'INVALID_INPUT', /máximo 20/);
  });
});

describe('SplitPdfUseCase', () => {
  function setup() {
    const engine = engineMock();
    const zip = zipMock();
    return { engine, zip, useCase: new SplitPdfUseCase(engine as unknown as IPdfEngine, zip as unknown as IZipBuilder) };
  }

  it('mode=ranges gera ZIP com 1 PDF por intervalo e nomes descritivos', async () => {
    const { engine, zip, useCase } = setup();
    const result = await useCase.execute({ file: pdfFile('Relatório.pdf'), options: JSON.stringify({ mode: 'ranges', ranges: '1-3,4-5' }) });
    expect(engine.splitGroups).toHaveBeenCalledWith(expect.any(Buffer), [[0, 1, 2], [3, 4]]);
    expect(zip.build.mock.calls[0][0].map((e: { name: string }) => e.name)).toEqual([
      'Relatorio_paginas_1-3.pdf',
      'Relatorio_paginas_4-5.pdf',
    ]);
    expect(result.fileName).toBe('Relatorio_dividido.zip');
    expect(result.contentType).toBe('application/zip');
    expect(result.meta).toMatchObject({ files: 2, originalPages: 5 });
  });

  it('mode=extract devolve PDF unico com as paginas pedidas', async () => {
    const { engine, useCase } = setup();
    const result = await useCase.execute({ file: pdfFile(), options: { mode: 'extract', pages: '1,3-4' } });
    expect(engine.extractPages).toHaveBeenCalledWith(expect.any(Buffer), [0, 2, 3]);
    expect(result.fileName).toBe('contrato_paginas_extraidas.pdf');
    expect(result.meta.pages).toBe(3);
  });

  it('mode=every gera 1 PDF por pagina', async () => {
    const { engine, useCase } = setup();
    await useCase.execute({ file: pdfFile(), options: { mode: 'every' } });
    expect(engine.splitGroups.mock.calls[0][1]).toEqual([[0], [1], [2], [3], [4]]);
  });

  it('valida modo, JSON e intervalos', async () => {
    const { useCase } = setup();
    await expectToolError(useCase.execute({ file: pdfFile(), options: { mode: 'x' } }), 'INVALID_INPUT', /modo de divisão/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: '{oops' }), 'INVALID_INPUT', /JSON válido/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { mode: 'ranges', ranges: '1-9' } }), 'INVALID_INPUT', /não existe/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { mode: 'extract' } }), 'INVALID_INPUT', /Informe/);
  });

  it('propaga ENCRYPTED_PDF do motor', async () => {
    const { engine, useCase } = setup();
    const { PdfToolsError } = await import('../../domain/pdf-tools.errors');
    engine.getPageCount.mockRejectedValue(new PdfToolsError('ENCRYPTED_PDF', 'protegido'));
    await expectToolError(useCase.execute({ file: pdfFile(), options: { mode: 'every' } }), 'ENCRYPTED_PDF');
  });
});
