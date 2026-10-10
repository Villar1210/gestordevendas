// src/modules/pdf_tools/domain/services/pdf-text-extractor.interface.ts
export interface ExtractedText {
  pages: number;
  byPage: { page: number; text: string }[];
}

export interface IPdfTextExtractor {
  extract(pdf: Buffer): Promise<ExtractedText>;
}
