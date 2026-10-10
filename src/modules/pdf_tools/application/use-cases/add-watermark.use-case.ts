// src/modules/pdf_tools/application/use-cases/add-watermark.use-case.ts
// 1 a 20 PDFs, mesma marca para todos. Lote -> marca_dagua.zip.
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readBoolean, readEnum, readNumber, readString } from '../options';
import { assertBatchCount, BatchProcessor } from '../batch-processor';

export const WATERMARK_BATCH_ZIP_NAME = 'marca_dagua.zip';

@Injectable()
export class AddWatermarkUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    private readonly batch: BatchProcessor,
  ) {}

  async execute(input: { files: InputFile[]; options: unknown; signal?: AbortSignal }): Promise<PdfToolResult> {
    assertBatchCount(input.files, PDF_TOOLS_LIMITS.batchMaxFiles, 'PDFs');
    const options = parseOptions(input.options);
    const text = readString(options, 'text', 'o texto da marca d\'água', {
      min: PDF_TOOLS_LIMITS.watermarkTextMin,
      max: PDF_TOOLS_LIMITS.watermarkTextMax,
    })!;
    if (text.trim() === '') {
      throw invalidInput('Informe o texto da marca d\'água.');
    }
    const opacity = readNumber(options, 'opacity', 'a opacidade', { min: 0.1, max: 0.6 }, 0.3);
    const size = readEnum(options, 'size', ['pequeno', 'medio', 'grande'] as const, 'o tamanho', 'medio');
    const diagonal = readBoolean(options, 'diagonal', 'diagonal', true);

    const results = await this.batch.run(input.files, {
      validate: (file) => this.engine.getPageCount(file.buffer),
      weight: (pages) => pages,
      process: async (file, total): Promise<PdfToolResult> => {
        const data = await this.engine.addWatermark(file.buffer, { text: text.trim(), opacity, size, diagonal });
        return {
          data,
          fileName: buildOutputFileName(file.originalname, 'marca_dagua', 'pdf'),
          contentType: CONTENT_TYPES.pdf,
          meta: { pages: total, originalSize: file.buffer.length, resultSize: data.length },
        };
      },
    }, { signal: input.signal });
    return results.length === 1 ? results[0] : this.batch.zipResults(results, WATERMARK_BATCH_ZIP_NAME, ['pages']);
  }
}
