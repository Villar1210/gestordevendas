// src/modules/pdf_tools/application/use-cases/add-watermark.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readBoolean, readEnum, readNumber, readString } from '../options';

@Injectable()
export class AddWatermarkUseCase {
  constructor(@Inject('IPdfEngine') private readonly engine: IPdfEngine) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
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

    const total = await this.engine.getPageCount(input.file.buffer);
    const data = await this.engine.addWatermark(input.file.buffer, { text: text.trim(), opacity, size, diagonal });
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'marca_dagua', 'pdf'),
      contentType: CONTENT_TYPES.pdf,
      meta: { pages: total, originalSize: input.file.buffer.length, resultSize: data.length },
    };
  }
}
