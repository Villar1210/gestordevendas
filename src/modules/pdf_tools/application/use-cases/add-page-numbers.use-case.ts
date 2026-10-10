// src/modules/pdf_tools/application/use-cases/add-page-numbers.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readBoolean, readEnum, readNumber } from '../options';

@Injectable()
export class AddPageNumbersUseCase {
  constructor(@Inject('IPdfEngine') private readonly engine: IPdfEngine) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
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

    const total = await this.engine.getPageCount(input.file.buffer);
    const data = await this.engine.addPageNumbers(input.file.buffer, { position, format, startAt, skipFirst });
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'numerado', 'pdf'),
      contentType: CONTENT_TYPES.pdf,
      meta: { pages: total, originalSize: input.file.buffer.length, resultSize: data.length },
    };
  }
}
