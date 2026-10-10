// Helpers compartilhados pelos specs dos casos de uso (mocks no padrao do
// projeto: objetos com jest.fn() convertidos via "as unknown as IX").
import { PdfToolsError, PdfToolsErrorCode } from '../../domain/pdf-tools.errors';

export function pdfFile(name = 'contrato.pdf', size = 1000) {
  return { buffer: Buffer.alloc(size, 1), originalname: name };
}

export function engineMock() {
  return {
    getPageCount: jest.fn().mockResolvedValue(5),
    merge: jest.fn().mockResolvedValue(Buffer.from('merged')),
    extractPages: jest.fn().mockResolvedValue(Buffer.from('extracted')),
    splitGroups: jest.fn(async (_pdf: Buffer, groups: number[][]) => groups.map((_, i) => Buffer.from(`part${i}`))),
    organize: jest.fn().mockResolvedValue(Buffer.from('organized')),
    rotate: jest.fn().mockResolvedValue(Buffer.from('rotated')),
    addPageNumbers: jest.fn().mockResolvedValue(Buffer.from('numbered')),
    addWatermark: jest.fn().mockResolvedValue(Buffer.from('watermarked')),
    imagesToPdf: jest.fn().mockResolvedValue(Buffer.from('images')),
    createTextPdf: jest.fn().mockResolvedValue({ pdf: Buffer.from('created'), pages: 2 }),
  };
}

export function availabilityMock(available = true) {
  return {
    getCapabilities: jest.fn().mockResolvedValue({ office: available, compress: available, security: available, raster: available }),
    isAvailable: jest.fn().mockResolvedValue(available),
  };
}

export function zipMock() {
  return { build: jest.fn().mockReturnValue(Buffer.from('zip')) };
}

export async function expectToolError(promise: Promise<unknown>, code: PdfToolsErrorCode, message?: RegExp) {
  await expect(promise).rejects.toBeInstanceOf(PdfToolsError);
  await promise.catch((error: PdfToolsError) => {
    expect(error.code).toBe(code);
    if (message) expect(error.message).toMatch(message);
  });
}

// Arquivo com sufixo .spec.ts de proposito: fica fora do build de producao
// (tsconfig exclui **/*.spec.ts). O teste abaixo so satisfaz o jest.
describe('mocks dos casos de uso', () => {
  it('engineMock expoe todos os metodos de IPdfEngine', () => {
    expect(Object.keys(engineMock())).toHaveLength(10);
  });
});
