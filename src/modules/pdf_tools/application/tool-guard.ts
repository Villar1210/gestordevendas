// src/modules/pdf_tools/application/tool-guard.ts
import { PdfToolsError } from '../domain/pdf-tools.errors';
import { IToolAvailability, PdfToolCapability } from '../domain/services/tool-availability.interface';

const NOMES: Record<PdfToolCapability, string> = {
  office: 'A conversão de documentos Office (LibreOffice)',
  compress: 'A compressão de PDF (Ghostscript)',
  security: 'A proteção/desbloqueio de PDF (qpdf)',
  raster: 'A conversão de PDF em imagem',
};

export async function ensureCapability(availability: IToolAvailability, capability: PdfToolCapability): Promise<void> {
  if (!(await availability.isAvailable(capability))) {
    throw new PdfToolsError(
      'TOOL_UNAVAILABLE',
      `${NOMES[capability]} não está disponível neste servidor no momento. Fale com o administrador.`,
    );
  }
}
