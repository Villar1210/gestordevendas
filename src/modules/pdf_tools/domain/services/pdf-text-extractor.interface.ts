// src/modules/pdf_tools/domain/services/pdf-text-extractor.interface.ts
export interface ExtractedText {
  pages: number;
  byPage: { page: number; text: string }[];
}

export interface ExtractTextOptions {
  /**
   * Para assim que o texto acumulado passar disso (PdfToolsError
   * TOO_LARGE), sem extrair as paginas seguintes.
   */
  maxChars?: number;
}

export interface IPdfTextExtractor {
  extract(pdf: Buffer, options?: ExtractTextOptions): Promise<ExtractedText>;
}
