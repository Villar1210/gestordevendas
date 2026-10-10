// src/modules/pdf_tools/application/use-cases/pdf-to-images.use-case.ts
// 1 pagina -> imagem direta; varias -> ZIP. Maximo 100 paginas (15 a 300 DPI).
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfRasterizer } from '../../domain/services/pdf-rasterizer.interface';
import { IZipBuilder } from '../../domain/services/zip-builder.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { parsePageRange } from '../../domain/page-range';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName, sanitizeBaseName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum, readString } from '../options';
import { ensureCapability } from '../tool-guard';

@Injectable()
export class PdfToImagesUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfRasterizer') private readonly rasterizer: IPdfRasterizer,
    @Inject('IZipBuilder') private readonly zip: IZipBuilder,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
  ) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
    const options = parseOptions(input.options);
    const format = readEnum(options, 'format', ['jpg', 'png'] as const, 'o formato da imagem', 'jpg');
    const dpi = readEnum(options, 'dpi', [72, 150, 300] as const, 'a resolução (DPI)', 150);
    const spec = readString(options, 'pages', 'as páginas', { min: 0, max: 500 }, false);
    await ensureCapability(this.availability, 'raster');

    const total = await this.engine.getPageCount(input.file.buffer);
    const indices =
      spec && spec.trim() !== '' ? parsePageRange(spec, total) : Array.from({ length: total }, (_, i) => i);
    const max = dpi === 300 ? PDF_TOOLS_LIMITS.rasterMaxPagesAt300Dpi : PDF_TOOLS_LIMITS.rasterMaxPages;
    if (indices.length > max) {
      throw invalidInput(
        `São no máximo ${max} páginas por vez${dpi === 300 ? ' em 300 DPI' : ''}. Selecione um intervalo menor (ex.: 1-${max}).`,
      );
    }

    const images = await this.rasterizer.render(input.file.buffer, indices, { format, dpi });
    if (images.length === 0) {
      throw invalidInput('Nenhuma página pôde ser convertida em imagem.');
    }
    const originalSize = input.file.buffer.length;
    if (images.length === 1) {
      const [img] = images;
      return {
        data: img.data,
        fileName: buildOutputFileName(input.file.originalname, `pagina_${img.page}`, format),
        contentType: CONTENT_TYPES[format],
        meta: { pages: 1, originalPages: total, originalSize, resultSize: img.data.length },
      };
    }
    const base = sanitizeBaseName(input.file.originalname);
    const digits = String(total).length;
    const data = this.zip.build(
      images.map((img) => ({ name: `${base}_pagina_${String(img.page).padStart(digits, '0')}.${format}`, data: img.data })),
    );
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'imagens', 'zip'),
      contentType: CONTENT_TYPES.zip,
      meta: { pages: images.length, originalPages: total, originalSize, resultSize: data.length },
    };
  }
}
