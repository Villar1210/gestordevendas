// src/modules/pdf_tools/application/use-cases/compress-pdf.use-case.ts
// Se o resultado nao ficar menor que o original, devolve o original com
// meta alreadyOptimized=true (o frontend avisa "ja estava otimizado").
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfCompressor } from '../../domain/services/pdf-compressor.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum } from '../options';
import { ensureCapability } from '../tool-guard';

@Injectable()
export class CompressPdfUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfCompressor') private readonly compressor: IPdfCompressor,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
  ) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
    const options = parseOptions(input.options);
    const level = readEnum(options, 'level', ['leve', 'recomendada', 'extrema'] as const, 'o nível de compressão', 'recomendada');
    await ensureCapability(this.availability, 'compress');
    // Carrega antes: PDF protegido/corrompido vira erro claro (422/400)
    // em vez de uma falha generica do Ghostscript.
    const pages = await this.engine.getPageCount(input.file.buffer);

    const compressed = await this.compressor.compress(input.file.buffer, level);
    const originalSize = input.file.buffer.length;
    const alreadyOptimized = compressed.length >= originalSize;
    const data = alreadyOptimized ? input.file.buffer : compressed;
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'comprimido', 'pdf'),
      contentType: CONTENT_TYPES.pdf,
      meta: { pages, originalSize, resultSize: data.length, alreadyOptimized, level },
    };
  }
}
