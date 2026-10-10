// src/modules/pdf_tools/application/use-cases/extract-text.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfTextExtractor } from '../../domain/services/pdf-text-extractor.interface';

export interface ExtractTextOutput {
  pages: number;
  text: string;
  byPage: { page: number; text: string }[];
}

@Injectable()
export class ExtractTextUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfTextExtractor') private readonly extractor: IPdfTextExtractor,
  ) {}

  async execute(input: { file: { buffer: Buffer } }): Promise<ExtractTextOutput> {
    // pdf-lib primeiro: PDF protegido -> 422 ENCRYPTED_PDF com a mensagem padrao.
    await this.engine.getPageCount(input.file.buffer);
    const result = await this.extractor.extract(input.file.buffer);
    const byPage = result.byPage.map((p) => ({ page: p.page, text: p.text.trim() }));
    return {
      pages: result.pages,
      text: byPage.map((p) => p.text).join('\n\n'),
      byPage,
    };
  }
}
