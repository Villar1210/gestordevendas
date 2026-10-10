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
  | 'LENGTH_REQUIRED'
  | 'BATCH_TIMEOUT'
  | 'ABORTED';

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

/** Cancelamento silencioso (o cliente desconectou; ninguem le a resposta). */
export function abortedError(): PdfToolsError {
  return new PdfToolsError('ABORTED', 'Processamento cancelado: a conexão foi encerrada.');
}

/** PDF com paginas demais (checado logo apos carregar, antes de percorrer as paginas). */
export function tooManyPagesError(pages: number, max: number): PdfToolsError {
  return new PdfToolsError(
    'TOO_LARGE',
    `O PDF tem ${pages.toLocaleString('pt-BR')} páginas; o limite é ${max.toLocaleString('pt-BR')} páginas por arquivo.`,
  );
}

export function invalidInput(message: string): PdfToolsError {
  return new PdfToolsError('INVALID_INPUT', message);
}
