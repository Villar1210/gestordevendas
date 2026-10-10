// src/modules/pdf_tools/domain/pdf-tools.errors.ts
// Camada de DOMINIO: erro proprio do modulo Ferramentas PDF. Nao conhece
// HTTP - o mapeamento code -> status (400/413/422/503/500) fica no
// PdfToolsExceptionFilter (infra/http).
export type PdfToolsErrorCode =
  | 'INVALID_INPUT'
  | 'ENCRYPTED_PDF'
  | 'WRONG_PASSWORD'
  | 'TOOL_UNAVAILABLE'
  | 'PROCESSING_FAILED'
  | 'TOO_LARGE'
  | 'LENGTH_REQUIRED';

export class PdfToolsError extends Error {
  constructor(
    public readonly code: PdfToolsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PdfToolsError';
  }
}

export const MENSAGEM_PDF_PROTEGIDO =
  'Este PDF está protegido por senha. Use a ferramenta Desbloquear PDF primeiro.';

export function invalidInput(message: string): PdfToolsError {
  return new PdfToolsError('INVALID_INPUT', message);
}
