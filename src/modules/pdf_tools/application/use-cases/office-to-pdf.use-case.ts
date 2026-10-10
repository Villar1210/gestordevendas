// src/modules/pdf_tools/application/use-cases/office-to-pdf.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IOfficeConverter, OfficeExtension } from '../../domain/services/office-converter.interface';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { sanitizeBaseName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { ensureCapability } from '../tool-guard';

export const OFFICE_EXTENSIONS: readonly OfficeExtension[] = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];

export function officeExtensionOf(fileName: string): OfficeExtension | null {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  return (OFFICE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as OfficeExtension) : null;
}

@Injectable()
export class OfficeToPdfUseCase {
  constructor(
    @Inject('IOfficeConverter') private readonly converter: IOfficeConverter,
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
  ) {}

  async execute(input: { file: InputFile }): Promise<PdfToolResult> {
    const extension = officeExtensionOf(input.file.originalname);
    if (!extension) {
      throw invalidInput(`Formato não suportado. Envie um arquivo ${OFFICE_EXTENSIONS.join(', ')}.`);
    }
    await ensureCapability(this.availability, 'office');
    const data = await this.converter.convertToPdf({ buffer: input.file.buffer, extension });
    const pages = await this.engine.getPageCount(data);
    return {
      data,
      fileName: `${sanitizeBaseName(input.file.originalname)}.pdf`,
      contentType: CONTENT_TYPES.pdf,
      meta: { pages, originalSize: input.file.buffer.length, resultSize: data.length },
    };
  }
}
