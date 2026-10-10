// src/modules/pdf_tools/application/use-cases/split-pdf.use-case.ts
// Dividir PDF: "ranges" (ZIP com 1 PDF por intervalo), "extract" (PDF unico
// com as paginas escolhidas) ou "every" (ZIP com 1 PDF por pagina).
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IZipBuilder } from '../../domain/services/zip-builder.interface';
import { parsePageRange, parsePageRangeGroups } from '../../domain/page-range';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { buildOutputFileName, sanitizeBaseName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum, readString } from '../options';

// Cada parte e um PDF completo (com os recursos das paginas) - limita o
// numero de partes para o ZIP nao explodir em memoria.
export const SPLIT_MAX_PARTS = 300;

function label(group: number[]): string {
  const first = group[0] + 1;
  const last = group[group.length - 1] + 1;
  return group.length === 1 ? `pagina_${first}` : `paginas_${first}-${last}`;
}

@Injectable()
export class SplitPdfUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IZipBuilder') private readonly zip: IZipBuilder,
  ) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
    const options = parseOptions(input.options);
    const mode = readEnum(options, 'mode', ['ranges', 'extract', 'every'] as const, 'o modo de divisão');
    const total = await this.engine.getPageCount(input.file.buffer);
    const base = sanitizeBaseName(input.file.originalname);
    const originalSize = input.file.buffer.length;

    if (mode === 'extract') {
      const spec = readString(options, 'pages', 'as páginas a extrair', { min: 1, max: 500 })!;
      const indices = parsePageRange(spec, total);
      const data = await this.engine.extractPages(input.file.buffer, indices);
      return {
        data,
        fileName: buildOutputFileName(input.file.originalname, 'paginas_extraidas', 'pdf'),
        contentType: CONTENT_TYPES.pdf,
        meta: { pages: indices.length, originalPages: total, originalSize, resultSize: data.length },
      };
    }

    let groups: number[][];
    if (mode === 'ranges') {
      const spec = readString(options, 'ranges', 'os intervalos', { min: 1, max: 500 })!;
      groups = parsePageRangeGroups(spec, total);
    } else {
      groups = Array.from({ length: total }, (_, i) => [i]);
    }
    if (groups.length > SPLIT_MAX_PARTS) {
      throw invalidInput(`A divisão geraria ${groups.length} arquivos. O máximo é ${SPLIT_MAX_PARTS}.`);
    }

    const parts = await this.engine.splitGroups(input.file.buffer, groups);
    const usedNames = new Set<string>();
    const entries = parts.map((data, i) => {
      let name = `${base}_${label(groups[i])}.pdf`;
      if (usedNames.has(name)) name = `${base}_${label(groups[i])}_${i + 1}.pdf`;
      usedNames.add(name);
      return { name, data };
    });
    const data = this.zip.build(entries);
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'dividido', 'zip'),
      contentType: CONTENT_TYPES.zip,
      meta: { files: entries.length, originalPages: total, originalSize, resultSize: data.length },
    };
  }
}
