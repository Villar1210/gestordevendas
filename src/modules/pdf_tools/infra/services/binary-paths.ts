// src/modules/pdf_tools/infra/services/binary-paths.ts
// Caminhos dos binarios, configuraveis por env (padrao: no PATH).
export function sofficePath(): string {
  if (process.env.LIBREOFFICE_PATH) return process.env.LIBREOFFICE_PATH;
  if (process.platform === 'win32') return 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
  return 'soffice';
}

export function qpdfPath(): string {
  return process.env.QPDF_PATH || 'qpdf';
}

export function ghostscriptPath(): string {
  if (process.env.GHOSTSCRIPT_PATH) return process.env.GHOSTSCRIPT_PATH;
  return process.platform === 'win32' ? 'gswin64c' : 'gs';
}
