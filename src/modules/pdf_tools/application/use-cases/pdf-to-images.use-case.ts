// src/modules/pdf_tools/application/use-cases/pdf-to-images.use-case.ts
// PDF -> JPG/PNG, 1 a 20 PDFs por vez.
// - 1 PDF, 1 pagina  -> imagem direta;
// - 1 PDF, varias    -> ZIP (<nome>_pagina_01.jpg ...);
// - varios PDFs      -> imagens_pdf.zip com UMA pasta por PDF
//   (<nome>/<nome>_pagina_01.jpg; nomes repetidos viram "nome (2)").
// Limite de paginas e sobre o TOTAL do lote (100; 15 em 300 DPI), validado
// contando as paginas de todos os PDFs ANTES de rasterizar qualquer uma.
// Intervalo de paginas ("pages") so vale com 1 PDF.
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfRasterizer, RasterFormat, RasterPage } from '../../domain/services/pdf-rasterizer.interface';
import { IZipBuilder, ZipEntry } from '../../domain/services/zip-builder.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { parsePageRange } from '../../domain/page-range';
import { invalidInput, PdfToolsError } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName, sanitizeBaseName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum, readString } from '../options';
import { ensureCapability } from '../tool-guard';

export const PDF_TO_IMAGES_BATCH_ZIP_NAME = 'imagens_pdf.zip';

interface PlannedFile {
  file: InputFile;
  totalPages: number;
  indices: number[];
}

/** Pastas unicas por PDF: "contrato", "contrato (2)"... (sem diferenciar maiusculas). */
export function uniqueFolderNames(originalNames: string[]): string[] {
  const used = new Set<string>();
  return originalNames.map((original) => {
    const base = sanitizeBaseName(original);
    let candidate = base;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

@Injectable()
export class PdfToImagesUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfRasterizer') private readonly rasterizer: IPdfRasterizer,
    @Inject('IZipBuilder') private readonly zip: IZipBuilder,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
  ) {}

  async execute(input: { files: InputFile[]; options: unknown }): Promise<PdfToolResult> {
    const { files } = input;
    if (!files || files.length === 0) throw invalidInput('Envie pelo menos 1 PDF.');
    if (files.length > PDF_TOOLS_LIMITS.pdfToImagesMaxFiles) {
      throw invalidInput(`Envie no máximo ${PDF_TOOLS_LIMITS.pdfToImagesMaxFiles} PDFs por vez.`);
    }
    const options = parseOptions(input.options);
    const format = readEnum(options, 'format', ['jpg', 'png'] as const, 'o formato da imagem', 'jpg');
    const dpi = readEnum(options, 'dpi', [72, 150, 300] as const, 'a resolução (DPI)', 150);
    const spec = readString(options, 'pages', 'as páginas', { min: 0, max: 500 }, false);
    const hasRange = !!spec && spec.trim() !== '';
    if (hasRange && files.length > 1) {
      throw invalidInput(
        'O intervalo de páginas só pode ser usado com 1 PDF. Com vários PDFs, todas as páginas de cada arquivo são convertidas.',
      );
    }
    await ensureCapability(this.availability, 'raster');

    // 1) Conta as paginas de TODOS antes de rasterizar qualquer uma.
    const planned: PlannedFile[] = [];
    for (const file of files) {
      const totalPages = await this.countPages(file, files.length > 1);
      const indices = hasRange ? parsePageRange(spec!, totalPages) : Array.from({ length: totalPages }, (_, i) => i);
      planned.push({ file, totalPages, indices });
    }
    const requested = planned.reduce((acc, p) => acc + p.indices.length, 0);
    const max = dpi === 300 ? PDF_TOOLS_LIMITS.rasterMaxPagesAt300Dpi : PDF_TOOLS_LIMITS.rasterMaxPages;
    if (requested > max) {
      const dpiNote = dpi === 300 ? ' em 300 DPI' : '';
      throw invalidInput(
        files.length > 1
          ? `Os ${files.length} PDFs somam ${requested} páginas, mas são no máximo ${max} páginas por vez${dpiNote}. Envie menos arquivos ou use uma resolução menor.`
          : `São no máximo ${max} páginas por vez${dpiNote}. Selecione um intervalo menor (ex.: 1-${max}).`,
      );
    }

    // 2) Rasteriza um PDF por vez (o rasterizador ja serializa os renders).
    const rendered: RasterPage[][] = [];
    for (const p of planned) {
      rendered.push(await this.rasterizer.render(p.file.buffer, p.indices, { format, dpi }));
    }
    const imageCount = rendered.reduce((acc, r) => acc + r.length, 0);
    if (imageCount === 0) throw invalidInput('Nenhuma página pôde ser convertida em imagem.');

    const originalSize = files.reduce((acc, f) => acc + f.buffer.length, 0);
    const originalPages = planned.reduce((acc, p) => acc + p.totalPages, 0);
    if (files.length === 1) return this.singleResult(planned[0], rendered[0], format, originalSize);

    const folders = uniqueFolderNames(files.map((f) => f.originalname));
    const entries: ZipEntry[] = [];
    planned.forEach((p, i) => {
      entries.push(...this.pageEntries(rendered[i], sanitizeBaseName(p.file.originalname), p.totalPages, format, folders[i]));
    });
    const data = this.zip.build(entries);
    return {
      data,
      fileName: PDF_TO_IMAGES_BATCH_ZIP_NAME,
      contentType: CONTENT_TYPES.zip,
      meta: { files: files.length, pages: imageCount, originalPages, originalSize, resultSize: data.length },
    };
  }

  private singleResult(p: PlannedFile, images: RasterPage[], format: RasterFormat, originalSize: number): PdfToolResult {
    if (images.length === 1) {
      const [img] = images;
      return {
        data: img.data,
        fileName: buildOutputFileName(p.file.originalname, `pagina_${img.page}`, format),
        contentType: CONTENT_TYPES[format],
        meta: { files: 1, pages: 1, originalPages: p.totalPages, originalSize, resultSize: img.data.length },
      };
    }
    const data = this.zip.build(this.pageEntries(images, sanitizeBaseName(p.file.originalname), p.totalPages, format));
    return {
      data,
      fileName: buildOutputFileName(p.file.originalname, 'imagens', 'zip'),
      contentType: CONTENT_TYPES.zip,
      meta: { files: 1, pages: images.length, originalPages: p.totalPages, originalSize, resultSize: data.length },
    };
  }

  private pageEntries(
    images: RasterPage[],
    base: string,
    totalPages: number,
    format: RasterFormat,
    folder?: string,
  ): ZipEntry[] {
    const digits = String(totalPages).length;
    return images.map((img) => ({
      name: `${base}_pagina_${String(img.page).padStart(digits, '0')}.${format}`,
      data: img.data,
      ...(folder !== undefined ? { folder } : {}),
    }));
  }

  /** Conta as paginas; no lote, o erro diz QUAL arquivo falhou. */
  private async countPages(file: InputFile, batch: boolean): Promise<number> {
    try {
      return await this.engine.getPageCount(file.buffer);
    } catch (error) {
      if (!(error instanceof PdfToolsError)) throw error;
      const name = file.originalname;
      if (error.code === 'ENCRYPTED_PDF') {
        throw new PdfToolsError(
          'ENCRYPTED_PDF',
          batch
            ? `"${name}" está protegido por senha. Remova-o da lista ou use a ferramenta Desbloquear PDF primeiro.`
            : `"${name}" está protegido por senha. Use a ferramenta Desbloquear PDF primeiro.`,
        );
      }
      if (error.code === 'INVALID_INPUT' && batch) {
        throw invalidInput(`Não foi possível ler "${name}". Verifique se o arquivo não está corrompido.`);
      }
      throw error;
    }
  }
}
