// src/modules/pdf_tools/application/use-cases/organize-pdf.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine, PageArrangement, RotationAngle } from '../../domain/services/pdf-engine.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions } from '../options';

const ANGLES: readonly number[] = [0, 90, 180, 270];
const MAX_OUTPUT_PAGES = 2000;

@Injectable()
export class OrganizePdfUseCase {
  constructor(@Inject('IPdfEngine') private readonly engine: IPdfEngine) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
    const options = parseOptions(input.options);
    const raw = options.pages;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw invalidInput('Mantenha pelo menos 1 página no documento.');
    }
    if (raw.length > MAX_OUTPUT_PAGES) {
      throw invalidInput(`O documento final pode ter no máximo ${MAX_OUTPUT_PAGES} páginas.`);
    }
    const total = await this.engine.getPageCount(input.file.buffer);

    const pages: PageArrangement[] = raw.map((item: unknown, pos) => {
      if (typeof item !== 'object' || item === null) {
        throw invalidInput(`Página na posição ${pos + 1} inválida.`);
      }
      const { index, rotate } = item as { index?: unknown; rotate?: unknown };
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= total) {
        throw invalidInput(`Página na posição ${pos + 1} inválida: o PDF tem ${total} páginas.`);
      }
      const angle = rotate === undefined || rotate === null ? 0 : rotate;
      if (typeof angle !== 'number' || !ANGLES.includes(angle)) {
        throw invalidInput('Rotação inválida. Use 0, 90, 180 ou 270.');
      }
      return { index, rotate: angle as RotationAngle };
    });

    const data = await this.engine.organize(input.file.buffer, pages);
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'organizado', 'pdf'),
      contentType: CONTENT_TYPES.pdf,
      meta: { pages: pages.length, originalPages: total, originalSize: input.file.buffer.length, resultSize: data.length },
    };
  }
}
