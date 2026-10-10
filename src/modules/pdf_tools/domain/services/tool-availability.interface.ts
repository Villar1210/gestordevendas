// src/modules/pdf_tools/domain/services/tool-availability.interface.ts
// Ferramentas que dependem de binario/lib nativa do servidor e podem nao
// existir (ex.: qpdf/gs na VPS).
export type PdfToolCapability = 'office' | 'compress' | 'security' | 'raster';

export type PdfToolsCapabilities = Record<PdfToolCapability, boolean>;

export interface IToolAvailability {
  getCapabilities(): Promise<PdfToolsCapabilities>;
  isAvailable(capability: PdfToolCapability): Promise<boolean>;
}
