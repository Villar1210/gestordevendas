// src/modules/pdf_tools/domain/services/pdf-compressor.interface.ts
export type CompressionLevel = 'leve' | 'recomendada' | 'extrema';

export interface IPdfCompressor {
  compress(pdf: Buffer, level: CompressionLevel): Promise<Buffer>;
}
