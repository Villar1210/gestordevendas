import { ImagesToPdfUseCase } from './images-to-pdf.use-case';
import { ExtractTextUseCase } from './extract-text.use-case';
import { CreatePdfUseCase } from './create-pdf.use-case';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfTextExtractor } from '../../domain/services/pdf-text-extractor.interface';
import { engineMock, expectToolError } from './pdf-tools.mocks.spec';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

describe('ImagesToPdfUseCase', () => {
  it('detecta o tipo pelos magic bytes e aplica defaults', async () => {
    const engine = engineMock();
    const result = await new ImagesToPdfUseCase(engine as unknown as IPdfEngine).execute({
      files: [
        { buffer: JPG, originalname: 'foto.png' }, // extensao mentirosa: vale o conteudo
        { buffer: PNG, originalname: 'b.png' },
      ],
      options: undefined,
    });
    expect(engine.imagesToPdf).toHaveBeenCalledWith(
      [
        { buffer: JPG, kind: 'jpg' },
        { buffer: PNG, kind: 'png' },
      ],
      { pageSize: 'A4', orientation: 'auto', margin: 'pequena' },
    );
    expect(result.fileName).toBe('imagens.pdf');
    expect(result.meta.pages).toBe(2);
  });

  it('1 imagem nomeia pelo arquivo; rejeita nao-imagem e opcoes invalidas', async () => {
    const useCase = new ImagesToPdfUseCase(engineMock() as unknown as IPdfEngine);
    const one = await useCase.execute({ files: [{ buffer: JPG, originalname: 'planta.jpg' }], options: { pageSize: 'ajustar' } });
    expect(one.fileName).toBe('planta_imagem.pdf');
    await expectToolError(useCase.execute({ files: [{ buffer: Buffer.from('%PDF-'), originalname: 'x.jpg' }], options: {} }), 'INVALID_INPUT');
    await expectToolError(useCase.execute({ files: [], options: {} }), 'INVALID_INPUT', /pelo menos 1/);
    await expectToolError(useCase.execute({ files: [{ buffer: JPG, originalname: 'a.jpg' }], options: { margin: 'enorme' } }), 'INVALID_INPUT');
    await expectToolError(
      useCase.execute({ files: Array.from({ length: 51 }, () => ({ buffer: JPG, originalname: 'a.jpg' })), options: {} }),
      'INVALID_INPUT',
      /máximo 50/,
    );
  });
});

describe('ExtractTextUseCase', () => {
  it('junta as paginas e faz trim', async () => {
    const engine = engineMock();
    const extractor = {
      extract: jest.fn().mockResolvedValue({ pages: 2, byPage: [{ page: 1, text: ' Ação \n' }, { page: 2, text: 'São João' }] }),
    };
    const result = await new ExtractTextUseCase(engine as unknown as IPdfEngine, extractor as unknown as IPdfTextExtractor).execute({
      file: { buffer: Buffer.from('%PDF-') },
    });
    expect(engine.getPageCount).toHaveBeenCalled();
    expect(result).toEqual({
      pages: 2,
      text: 'Ação\n\nSão João',
      byPage: [
        { page: 1, text: 'Ação' },
        { page: 2, text: 'São João' },
      ],
    });
  });
});

describe('CreatePdfUseCase', () => {
  it('cria com defaults A4/12', async () => {
    const engine = engineMock();
    const result = await new CreatePdfUseCase(engine as unknown as IPdfEngine).execute({ body: { content: '# Olá' } });
    expect(engine.createTextPdf).toHaveBeenCalledWith({ title: undefined, content: '# Olá', pageSize: 'A4', fontSize: 12 });
    expect(result.fileName).toBe('documento.pdf');
    expect(result.meta.pages).toBe(2);
  });

  it('valida conteudo, tamanho, pageSize e fontSize', async () => {
    const useCase = new CreatePdfUseCase(engineMock() as unknown as IPdfEngine);
    await expectToolError(useCase.execute({ body: {} }), 'INVALID_INPUT', /Informe o conteúdo/);
    await expectToolError(useCase.execute({ body: { content: '  ' } }), 'INVALID_INPUT', /Escreva/);
    await expectToolError(useCase.execute({ body: { content: 'x'.repeat(50_001) } }), 'INVALID_INPUT', /50000/);
    await expectToolError(useCase.execute({ body: { content: 'a', pageSize: 'A3' } }), 'INVALID_INPUT');
    await expectToolError(useCase.execute({ body: { content: 'a', fontSize: 20 } }), 'INVALID_INPUT', /entre 10 e 16/);
    await expectToolError(useCase.execute({ body: { content: 'a', title: 1 } }), 'INVALID_INPUT');
  });
});
