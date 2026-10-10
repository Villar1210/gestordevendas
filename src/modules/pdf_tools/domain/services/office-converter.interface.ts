// src/modules/pdf_tools/domain/services/office-converter.interface.ts
export type OfficeExtension = 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'odt' | 'ods' | 'odp';

/**
 * Opcoes de execucao (todas opcionais): timeoutMs = tempo maximo desta
 * execucao (a implementacao usa o menor entre ele e o proprio limite);
 * signal = cancela (mata o binario) quando o cliente desconecta.
 */
export interface ProcessTimeoutOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface IOfficeConverter {
  convertToPdf(input: { buffer: Buffer; extension: OfficeExtension }, options?: ProcessTimeoutOptions): Promise<Buffer>;
}
