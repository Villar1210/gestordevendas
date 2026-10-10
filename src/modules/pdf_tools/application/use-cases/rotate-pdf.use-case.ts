// src/modules/pdf_tools/application/use-cases/rotate-pdf.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { parsePageRange } from '../../domain/page-range';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum, readString } from '../options';

@Injectable()
export class RotatePdfUseCase {
  constructor(@Inject('IPdfEngine') private readonly engine: IPdfEngine) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
    const options = parseOptions(input.options);
    const angle = readEnum(options, 'angle', [90, 180, 270] as const, 'o ângulo de rotação');
    const spec = readString(options, 'pages', 'as páginas', { min: 0, max: 500 }, false);
    const total = await this.engine.getPageCount(input.file.buffer);
    const indices = spec && spec.trim() !== '' ? parsePageRange(spec, total) : null;

    const data = await this.engine.rotate(input.file.buffer, angle, indices);
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'girado', 'pdf'),
      contentType: CONTENT_TYPES.pdf,
      meta: {
        pages: total,
        rotatedPages: indices ? indices.length : total,
        originalSize: input.file.buffer.length,
        resultSize: data.length,
      },
    };
  }
}
