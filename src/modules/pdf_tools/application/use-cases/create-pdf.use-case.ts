// src/modules/pdf_tools/application/use-cases/create-pdf.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { CONTENT_TYPES, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum, readNumber, readString } from '../options';

@Injectable()
export class CreatePdfUseCase {
  constructor(@Inject('IPdfEngine') private readonly engine: IPdfEngine) {}

  async execute(input: { body: unknown }): Promise<PdfToolResult> {
    const body = parseOptions(input.body);
    const title = readString(body, 'title', 'o título', { min: 0, max: PDF_TOOLS_LIMITS.createTitleMax }, false);
    const content = readString(body, 'content', 'o conteúdo', { min: 0, max: PDF_TOOLS_LIMITS.createContentMax })!;
    if (content.trim() === '' && (!title || title.trim() === '')) {
      throw invalidInput('Escreva algum conteúdo para gerar o PDF.');
    }
    const pageSize = readEnum(body, 'pageSize', ['A4', 'Carta'] as const, 'o tamanho da página', 'A4');
    const fontSize = readNumber(
      body,
      'fontSize',
      'o tamanho da fonte',
      { min: PDF_TOOLS_LIMITS.createFontSizeMin, max: PDF_TOOLS_LIMITS.createFontSizeMax },
      12,
    );

    const { pdf, pages } = await this.engine.createTextPdf({
      title: title?.trim() || undefined,
      content,
      pageSize,
      fontSize,
    });
    return {
      data: pdf,
      fileName: 'documento.pdf',
      contentType: CONTENT_TYPES.pdf,
      meta: { pages, resultSize: pdf.length },
    };
  }
}
