// src/modules/pdf_tools/domain/services/pdf-engine.interface.ts
// Camada de DOMINIO: manipulacao de PDF "pura" (sem binarios externos).
// A implementacao (pdf-lib) fica em infra/services. Erros esperados sao
// PdfToolsError (ENCRYPTED_PDF para PDF protegido, INVALID_INPUT para PDF
// ilegivel).
export type RotationAngle = 0 | 90 | 180 | 270;
export type PageNumberPosition = 'inferior-centro' | 'inferior-direita' | 'superior-direita';
export type PageNumberFormat = 'n' | 'n-de-total' | 'pagina-n';
export type WatermarkSize = 'pequeno' | 'medio' | 'grande';
export type ImagePageSize = 'A4' | 'Carta' | 'ajustar';
export type ImageOrientation = 'retrato' | 'paisagem' | 'auto';
export type ImageMargin = 'nenhuma' | 'pequena' | 'grande';
export type TextPageSize = 'A4' | 'Carta';

export interface PageArrangement {
  index: number; // 0-based na origem
  rotate: RotationAngle; // somado a rotacao atual da pagina
}

export interface PageNumberOptions {
  position: PageNumberPosition;
  format: PageNumberFormat;
  startAt: number;
  skipFirst: boolean;
}

export interface WatermarkOptions {
  text: string;
  opacity: number;
  size: WatermarkSize;
  diagonal: boolean;
}

export interface ImageInput {
  buffer: Buffer;
  kind: 'jpg' | 'png';
}

export interface ImagesToPdfOptions {
  pageSize: ImagePageSize;
  orientation: ImageOrientation;
  margin: ImageMargin;
}

export interface CreateTextPdfOptions {
  title?: string;
  content: string;
  pageSize: TextPageSize;
  fontSize: number;
}

export interface IPdfEngine {
  /** Numero de paginas. Lanca ENCRYPTED_PDF se protegido. */
  getPageCount(pdf: Buffer): Promise<number>;
  merge(pdfs: Buffer[]): Promise<Buffer>;
  /** Um PDF novo com as paginas (0-based) na ordem informada. */
  extractPages(pdf: Buffer, indices: number[]): Promise<Buffer>;
  /** Um PDF por grupo de paginas (0-based). */
  splitGroups(pdf: Buffer, groups: number[][]): Promise<Buffer[]>;
  organize(pdf: Buffer, pages: PageArrangement[]): Promise<Buffer>;
  /** indices null = todas as paginas */
  rotate(pdf: Buffer, angle: Exclude<RotationAngle, 0>, indices: number[] | null): Promise<Buffer>;
  addPageNumbers(pdf: Buffer, options: PageNumberOptions): Promise<Buffer>;
  addWatermark(pdf: Buffer, options: WatermarkOptions): Promise<Buffer>;
  imagesToPdf(images: ImageInput[], options: ImagesToPdfOptions): Promise<Buffer>;
  createTextPdf(options: CreateTextPdfOptions): Promise<{ pdf: Buffer; pages: number }>;
}
