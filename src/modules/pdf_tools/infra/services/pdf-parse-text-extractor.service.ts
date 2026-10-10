// src/modules/pdf_tools/infra/services/pdf-parse-text-extractor.service.ts
// Extrai o texto PAGINA A PAGINA (pdf-parse "partial": [n]) e para assim
// que o total passa de maxChars - um PDF pequeno com o mesmo bloco de texto
// repetido em milhares de paginas nao chega a gerar centenas de MB de texto.
import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { ExtractedText, ExtractTextOptions, IPdfTextExtractor } from '../../domain/services/pdf-text-extractor.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';

@Injectable()
export class PdfParseTextExtractorService implements IPdfTextExtractor {
  async extract(pdf: Buffer, options: ExtractTextOptions = {}): Promise<ExtractedText> {
    const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY;
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    try {
      // getInfo carrega o documento (uma vez) e devolve o total de paginas.
      const { total } = await parser.getInfo({ parsePageInfo: false });
      const byPage: ExtractedText['byPage'] = [];
      let chars = 0;
      for (let num = 1; num <= total; num++) {
        const result = await parser.getText({ partial: [num], pageJoiner: '' });
        const text = result.pages[0]?.text ?? '';
        chars += text.length;
        if (chars > maxChars) {
          throw new PdfToolsError('TOO_LARGE', 'O texto extraído passa do limite de caracteres.');
        }
        byPage.push({ page: num, text });
      }
      return { pages: total, byPage };
    } catch (error) {
      if (error instanceof PdfToolsError) throw error;
      throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível extrair o texto do PDF.');
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
}
