// src/modules/pdf_tools/application/use-cases/compress-pdf.use-case.ts
// 1 a 20 PDFs. Se o resultado nao ficar menor que o original, devolve o
// original com meta alreadyOptimized=true (o frontend avisa "ja estava
// otimizado"). Lote -> comprimidos.zip (arquivo ja otimizado entra com o
// original); meta alreadyOptimized = QUANTOS ja estavam otimizados.
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfCompressor } from '../../domain/services/pdf-compressor.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum } from '../options';
import { ensureCapability } from '../tool-guard';
import { assertBatchCount, BatchProcessor } from '../batch-processor';

export const COMPRESS_BATCH_ZIP_NAME = 'comprimidos.zip';

@Injectable()
export class CompressPdfUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfCompressor') private readonly compressor: IPdfCompressor,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
    private readonly batch: BatchProcessor,
  ) {}

  async execute(input: { files: InputFile[]; options: unknown; signal?: AbortSignal }): Promise<PdfToolResult> {
    assertBatchCount(input.files, PDF_TOOLS_LIMITS.batchMaxFiles, 'PDFs');
    const options = parseOptions(input.options);
    const level = readEnum(options, 'level', ['leve', 'recomendada', 'extrema'] as const, 'o nível de compressão', 'recomendada');
    await ensureCapability(this.availability, 'compress');

    const results = await this.batch.run(input.files, {
      // Carrega antes: PDF protegido/corrompido vira erro claro (422/400)
      // em vez de uma falha generica do Ghostscript.
      validate: (file) => this.engine.getPageCount(file.buffer),
      weight: (pages) => pages,
      process: async (file, pages, _i, budget): Promise<PdfToolResult> => {
        const compressed = await (budget ? this.compressor.compress(file.buffer, level, budget) : this.compressor.compress(file.buffer, level));
        const originalSize = file.buffer.length;
        const alreadyOptimized = compressed.length >= originalSize;
        const data = alreadyOptimized ? file.buffer : compressed;
        return {
          data,
          fileName: buildOutputFileName(file.originalname, 'comprimido', 'pdf'),
          contentType: CONTENT_TYPES.pdf,
          meta: { pages, originalSize, resultSize: data.length, alreadyOptimized, level },
        };
      },
    }, { signal: input.signal });
    if (results.length === 1) return results[0];
    return this.batch.zipResults(results, COMPRESS_BATCH_ZIP_NAME, ['pages'], {
      alreadyOptimized: results.filter((r) => r.meta.alreadyOptimized === true).length,
      level,
    });
  }
}
