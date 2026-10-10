// src/modules/pdf_tools/domain/services/pdf-security.interface.ts
// A senha so trafega em memoria - implementacoes NUNCA podem colocar a
// senha em argv de processo nem em log.
export interface ProtectOptions {
  password: string;
  allowPrint: boolean;
  allowCopy: boolean;
}

export interface IPdfSecurity {
  /** Criptografa com AES-256. */
  protect(pdf: Buffer, options: ProtectOptions): Promise<Buffer>;
  /** Remove a senha. Lanca WRONG_PASSWORD se a senha nao confere. */
  unlock(pdf: Buffer, password: string): Promise<Buffer>;
}
