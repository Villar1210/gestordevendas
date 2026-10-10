// src/modules/pdf_tools/domain/services/pdf-rasterizer.interface.ts
export type RasterFormat = 'jpg' | 'png';
export type RasterDpi = 72 | 150 | 300;

export interface RasterPage {
  page: number; // 1-based
  data: Buffer;
}

export interface IPdfRasterizer {
  /** indices 0-based; devolve na mesma ordem. */
  render(pdf: Buffer, indices: number[], options: { format: RasterFormat; dpi: RasterDpi }): Promise<RasterPage[]>;
}
