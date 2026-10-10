// src/modules/pdf_tools/domain/file-signature.ts
// Deteccao de tipo por "magic bytes" (assinatura no inicio do arquivo) -
// nunca confiar so na extensao ou no mimetype enviado pelo navegador.
export type DetectedKind = 'pdf' | 'jpg' | 'png' | 'ole' | 'zip' | 'unknown';

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((b, i) => buffer[i] === b);
}

export function detectFileKind(buffer: Buffer): DetectedKind {
  // "%PDF-" - alguns geradores colocam lixo/BOM antes; o leitor tolera ate
  // 1 KB, mas aqui aceitamos so no inicio (mais restritivo e suficiente).
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0])) return 'ole';
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) return 'zip';
  return 'unknown';
}

/** Extensoes Office por container: OLE (formato antigo) x ZIP (OOXML/ODF). */
export const OFFICE_CONTAINER_BY_EXTENSION: Record<string, 'ole' | 'zip'> = {
  doc: 'ole',
  xls: 'ole',
  ppt: 'ole',
  docx: 'zip',
  xlsx: 'zip',
  pptx: 'zip',
  odt: 'zip',
  ods: 'zip',
  odp: 'zip',
};
