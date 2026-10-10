// src/modules/pdf_tools/application/use-cases/rotate-pdf.use-case.ts
// 1 a 20 PDFs, mesmo angulo para todos. Intervalo de paginas ("pages") so
// com 1 PDF (como no PDF -> imagem). Lote -> girados.zip.
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { parsePageRange } from '../../domain/page-range';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum, readString } from '../options';
import { assertBatchCount, BatchProcessor } from '../batch-processor';

export const ROTATE_BATCH_ZIP_NAME = 'girados.zip';

@Injectable()
export class RotatePdfUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    private readonly batch: BatchProcessor,
  ) {}

  async execute(input: { files: InputFile[]; options: unknown; signal?: AbortSignal }): Promise<PdfToolResult> {
    assertBatchCount(input.files, PDF_TOOLS_LIMITS.batchMaxFiles, 'PDFs');
    const options = parseOptions(input.options);
    const angle = readEnum(options, 'angle', [90, 180, 270] as const, 'o ângulo de rotação');
    const spec = readString(options, 'pages', 'as páginas', { min: 0, max: 500 }, false);
    const hasRange = !!spec && spec.trim() !== '';
    if (hasRange && input.files.length > 1) {
      throw invalidInput(
        'O intervalo de páginas só pode ser usado com 1 PDF. Com vários PDFs, todas as páginas de cada arquivo são giradas.',
      );
    }

    const results = await this.batch.run(input.files, {
      validate: async (file) => {
        const total = await this.engine.getPageCount(file.buffer);
        return { total, indices: hasRange ? parsePageRange(spec!, total) : null };
      },
      weight: ({ total }) => total,
      process: async (file, { total, indices }): Promise<PdfToolResult> => {
        const data = await this.engine.rotate(file.buffer, angle, indices);
        return {
          data,
          fileName: buildOutputFileName(file.originalname, 'girado', 'pdf'),
          contentType: CONTENT_TYPES.pdf,
          meta: {
            pages: total,
            rotatedPages: indices ? indices.length : total,
            originalSize: file.buffer.length,
            resultSize: data.length,
          },
        };
      },
    }, { signal: input.signal });
    return results.length === 1
      ? results[0]
      : this.batch.zipResults(results, ROTATE_BATCH_ZIP_NAME, ['pages', 'rotatedPages']);
  }
}
