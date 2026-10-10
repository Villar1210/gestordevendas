// src/modules/pdf_tools/application/use-cases/add-page-numbers.use-case.ts
// 1 a 20 PDFs, mesmas opcoes para todos (cada PDF comeca em startAt).
// Lote -> numerados.zip.
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readBoolean, readEnum, readNumber } from '../options';
import { assertBatchCount, BatchProcessor } from '../batch-processor';

export const PAGE_NUMBERS_BATCH_ZIP_NAME = 'numerados.zip';

@Injectable()
export class AddPageNumbersUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    private readonly batch: BatchProcessor,
  ) {}

  async execute(input: { files: InputFile[]; options: unknown; signal?: AbortSignal }): Promise<PdfToolResult> {
    assertBatchCount(input.files, PDF_TOOLS_LIMITS.batchMaxFiles, 'PDFs');
    const options = parseOptions(input.options);
    const position = readEnum(
      options,
      'position',
      ['inferior-centro', 'inferior-direita', 'superior-direita'] as const,
      'a posição do número',
      'inferior-centro',
    );
    const format = readEnum(options, 'format', ['n', 'n-de-total', 'pagina-n'] as const, 'o formato do número', 'n');
    const startAt = readNumber(options, 'startAt', 'o número inicial', { min: 1, max: PDF_TOOLS_LIMITS.startAtMax, integer: true }, 1);
    const skipFirst = readBoolean(options, 'skipFirst', 'pular a primeira página', false);

    const results = await this.batch.run(input.files, {
      validate: (file) => this.engine.getPageCount(file.buffer),
      weight: (pages) => pages,
      process: async (file, total): Promise<PdfToolResult> => {
        const data = await this.engine.addPageNumbers(file.buffer, { position, format, startAt, skipFirst });
        return {
          data,
          fileName: buildOutputFileName(file.originalname, 'numerado', 'pdf'),
          contentType: CONTENT_TYPES.pdf,
          meta: { pages: total, originalSize: file.buffer.length, resultSize: data.length },
        };
      },
    }, { signal: input.signal });
    return results.length === 1 ? results[0] : this.batch.zipResults(results, PAGE_NUMBERS_BATCH_ZIP_NAME, ['pages']);
  }
}
