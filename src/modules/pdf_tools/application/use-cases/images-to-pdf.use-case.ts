// src/modules/pdf_tools/application/use-cases/images-to-pdf.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { ImageInput, IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { detectFileKind } from '../../domain/file-signature';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readEnum } from '../options';

@Injectable()
export class ImagesToPdfUseCase {
  constructor(@Inject('IPdfEngine') private readonly engine: IPdfEngine) {}

  async execute(input: { files: InputFile[]; options: unknown }): Promise<PdfToolResult> {
    const options = parseOptions(input.options);
    const pageSize = readEnum(options, 'pageSize', ['A4', 'Carta', 'ajustar'] as const, 'o tamanho da página', 'A4');
    const orientation = readEnum(options, 'orientation', ['retrato', 'paisagem', 'auto'] as const, 'a orientação', 'auto');
    const margin = readEnum(options, 'margin', ['nenhuma', 'pequena', 'grande'] as const, 'a margem', 'pequena');

    const { files } = input;
    if (files.length < PDF_TOOLS_LIMITS.imagesMinFiles) {
      throw invalidInput('Envie pelo menos 1 imagem JPG ou PNG.');
    }
    if (files.length > PDF_TOOLS_LIMITS.imagesMaxFiles) {
      throw invalidInput(`Envie no máximo ${PDF_TOOLS_LIMITS.imagesMaxFiles} imagens por vez.`);
    }
    const images: ImageInput[] = files.map((f) => {
      const kind = detectFileKind(f.buffer);
      if (kind !== 'jpg' && kind !== 'png') {
        throw invalidInput(`"${f.originalname}" não é uma imagem JPG ou PNG válida.`);
      }
      return { buffer: f.buffer, kind };
    });

    const data = await this.engine.imagesToPdf(images, { pageSize, orientation, margin });
    return {
      data,
      fileName: files.length === 1 ? buildOutputFileName(files[0].originalname, 'imagem', 'pdf') : 'imagens.pdf',
      contentType: CONTENT_TYPES.pdf,
      meta: {
        pages: images.length,
        originalSize: files.reduce((acc, f) => acc + f.buffer.length, 0),
        resultSize: data.length,
      },
    };
  }
}
