// src/modules/pdf_tools/infra/services/pdf-parse-text-extractor.service.ts
import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { ExtractedText, IPdfTextExtractor } from '../../domain/services/pdf-text-extractor.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';

@Injectable()
export class PdfParseTextExtractorService implements IPdfTextExtractor {
  async extract(pdf: Buffer): Promise<ExtractedText> {
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    try {
      const result = await parser.getText({ pageJoiner: '' });
      return {
        pages: result.total,
        byPage: result.pages.map((p) => ({ page: p.num, text: p.text ?? '' })),
      };
    } catch {
      throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível extrair o texto do PDF.');
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
}
