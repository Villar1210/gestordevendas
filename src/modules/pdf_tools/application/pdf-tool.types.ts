// src/modules/pdf_tools/application/pdf-tool.types.ts
// Tipos compartilhados pelos casos de uso do modulo Ferramentas PDF.
export interface InputFile {
  buffer: Buffer;
  originalname: string;
}

export type PdfToolsMeta = Record<string, string | number | boolean>;

/** Resultado binario de uma ferramenta (o controller transforma em download). */
export interface PdfToolResult {
  data: Buffer;
  fileName: string;
  contentType: string;
  meta: PdfToolsMeta;
}

export const CONTENT_TYPES = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  png: 'image/png',
} as const;
