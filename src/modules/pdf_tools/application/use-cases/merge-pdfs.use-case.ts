// src/modules/pdf_tools/application/use-cases/merge-pdfs.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { invalidInput, PdfToolsError } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';

@Injectable()
export class MergePdfsUseCase {
  constructor(@Inject('IPdfEngine') private readonly engine: IPdfEngine) {}

  async execute(input: { files: InputFile[] }): Promise<PdfToolResult> {
    const { files } = input;
    if (files.length < PDF_TOOLS_LIMITS.mergeMinFiles) {
      throw invalidInput('Envie pelo menos 2 PDFs para juntar.');
    }
    if (files.length > PDF_TOOLS_LIMITS.mergeMaxFiles) {
      throw invalidInput(`Envie no máximo ${PDF_TOOLS_LIMITS.mergeMaxFiles} PDFs por vez.`);
    }
    // Cada PDF ja e limitado a 2000 paginas ao carregar; o total do
    // documento unido segue o teto do lote (5000), conferido ANTES de juntar.
    let pages = 0;
    for (const f of files) pages += await this.engine.getPageCount(f.buffer);
    if (pages > PDF_TOOLS_LIMITS.batchMaxPagesTotal) {
      throw new PdfToolsError(
        'TOO_LARGE',
        `Os PDFs somam ${pages.toLocaleString('pt-BR')} páginas; o limite para juntar é ${PDF_TOOLS_LIMITS.batchMaxPagesTotal.toLocaleString('pt-BR')} páginas.`,
      );
    }
    const data = await this.engine.merge(files.map((f) => f.buffer));
    return {
      data,
      fileName: 'documento_unido.pdf',
      contentType: CONTENT_TYPES.pdf,
      meta: {
        files: files.length,
        pages,
        originalSize: files.reduce((acc, f) => acc + f.buffer.length, 0),
        resultSize: data.length,
      },
    };
  }
}
