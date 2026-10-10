import { OrganizePdfUseCase } from './organize-pdf.use-case';
import { RotatePdfUseCase } from './rotate-pdf.use-case';
import { AddPageNumbersUseCase } from './add-page-numbers.use-case';
import { AddWatermarkUseCase } from './add-watermark.use-case';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { engineMock, expectToolError, pdfFile } from './pdf-tools.mocks.spec';

function engine() {
  return engineMock();
}

describe('OrganizePdfUseCase', () => {
  it('repassa ordem e rotacao finais; paginas omitidas sao removidas', async () => {
    const e = engine();
    const useCase = new OrganizePdfUseCase(e as unknown as IPdfEngine);
    const result = await useCase.execute({
      file: pdfFile(),
      options: { pages: [{ index: 4, rotate: 90 }, { index: 0 }] },
    });
    expect(e.organize).toHaveBeenCalledWith(expect.any(Buffer), [
      { index: 4, rotate: 90 },
      { index: 0, rotate: 0 },
    ]);
    expect(result.fileName).toBe('contrato_organizado.pdf');
    expect(result.meta).toMatchObject({ pages: 2, originalPages: 5 });
  });

  it('rejeita lista vazia, indice fora do PDF e rotacao invalida', async () => {
    const useCase = new OrganizePdfUseCase(engine() as unknown as IPdfEngine);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { pages: [] } }), 'INVALID_INPUT', /pelo menos 1/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { pages: [{ index: 5 }] } }), 'INVALID_INPUT', /5 páginas/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { pages: [{ index: 1.5 }] } }), 'INVALID_INPUT');
    await expectToolError(useCase.execute({ file: pdfFile(), options: { pages: [{ index: 0, rotate: 45 }] } }), 'INVALID_INPUT', /Rotação/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { pages: ['x'] } }), 'INVALID_INPUT');
  });
});

describe('RotatePdfUseCase', () => {
  it('sem pages gira todas (indices null)', async () => {
    const e = engine();
    const result = await new RotatePdfUseCase(e as unknown as IPdfEngine).execute({ file: pdfFile(), options: { angle: 90 } });
    expect(e.rotate).toHaveBeenCalledWith(expect.any(Buffer), 90, null);
    expect(result.meta).toMatchObject({ rotatedPages: 5 });
    expect(result.fileName).toBe('contrato_girado.pdf');
  });

  it('com pages gira so o intervalo', async () => {
    const e = engine();
    await new RotatePdfUseCase(e as unknown as IPdfEngine).execute({ file: pdfFile(), options: { angle: 180, pages: '1-2' } });
    expect(e.rotate).toHaveBeenCalledWith(expect.any(Buffer), 180, [0, 1]);
  });

  it('rejeita angulo invalido ou ausente', async () => {
    const useCase = new RotatePdfUseCase(engine() as unknown as IPdfEngine);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { angle: 45 } }), 'INVALID_INPUT');
    await expectToolError(useCase.execute({ file: pdfFile(), options: {} }), 'INVALID_INPUT', /Informe/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { angle: '90' } }), 'INVALID_INPUT');
  });
});

describe('AddPageNumbersUseCase', () => {
  it('aplica defaults e repassa as opcoes', async () => {
    const e = engine();
    const useCase = new AddPageNumbersUseCase(e as unknown as IPdfEngine);
    await useCase.execute({ file: pdfFile(), options: undefined });
    expect(e.addPageNumbers).toHaveBeenLastCalledWith(expect.any(Buffer), {
      position: 'inferior-centro',
      format: 'n',
      startAt: 1,
      skipFirst: false,
    });
    const result = await useCase.execute({
      file: pdfFile(),
      options: { position: 'superior-direita', format: 'n-de-total', startAt: 3, skipFirst: true },
    });
    expect(e.addPageNumbers).toHaveBeenLastCalledWith(expect.any(Buffer), {
      position: 'superior-direita',
      format: 'n-de-total',
      startAt: 3,
      skipFirst: true,
    });
    expect(result.fileName).toBe('contrato_numerado.pdf');
  });

  it('valida enums, startAt inteiro e skipFirst booleano', async () => {
    const useCase = new AddPageNumbersUseCase(engine() as unknown as IPdfEngine);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { position: 'meio' } }), 'INVALID_INPUT');
    await expectToolError(useCase.execute({ file: pdfFile(), options: { startAt: 0 } }), 'INVALID_INPUT', /entre 1/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { startAt: 1.5 } }), 'INVALID_INPUT', /inteiro/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { skipFirst: 'sim' } }), 'INVALID_INPUT', /true ou false/);
  });
});

describe('AddWatermarkUseCase', () => {
  it('repassa texto (trim), opacidade, tamanho e diagonal', async () => {
    const e = engine();
    const result = await new AddWatermarkUseCase(e as unknown as IPdfEngine).execute({
      file: pdfFile(),
      options: { text: '  CONFIDENCIAL  ', opacity: 0.2, size: 'grande', diagonal: false },
    });
    expect(e.addWatermark).toHaveBeenCalledWith(expect.any(Buffer), {
      text: 'CONFIDENCIAL',
      opacity: 0.2,
      size: 'grande',
      diagonal: false,
    });
    expect(result.fileName).toBe('contrato_marca_dagua.pdf');
  });

  it('valida texto 1-60, opacidade 0.1-0.6 e tamanho', async () => {
    const useCase = new AddWatermarkUseCase(engine() as unknown as IPdfEngine);
    await expectToolError(useCase.execute({ file: pdfFile(), options: {} }), 'INVALID_INPUT', /Informe/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { text: '   ' } }), 'INVALID_INPUT');
    await expectToolError(useCase.execute({ file: pdfFile(), options: { text: 'x'.repeat(61) } }), 'INVALID_INPUT', /entre 1 e 60/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { text: 'a', opacity: 0.9 } }), 'INVALID_INPUT', /entre 0.1 e 0.6/);
    await expectToolError(useCase.execute({ file: pdfFile(), options: { text: 'a', size: 'gigante' } }), 'INVALID_INPUT');
  });
});
