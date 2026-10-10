// src/modules/pdf_tools/domain/services/pdf-compressor.interface.ts
export type CompressionLevel = 'leve' | 'recomendada' | 'extrema';

import { ProcessTimeoutOptions } from './office-converter.interface';

export interface IPdfCompressor {
  compress(pdf: Buffer, level: CompressionLevel, options?: ProcessTimeoutOptions): Promise<Buffer>;
}
