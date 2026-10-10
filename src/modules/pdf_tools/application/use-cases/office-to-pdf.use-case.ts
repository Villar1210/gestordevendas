// src/modules/pdf_tools/application/use-cases/office-to-pdf.use-case.ts
// 1 a 10 documentos (LibreOffice e lento; o nginx corta em 300s). Lote ->
// convertidos.zip com "<nome>.pdf" de cada documento.
import { Inject, Injectable } from '@nestjs/common';
import { IOfficeConverter, OfficeExtension } from '../../domain/services/office-converter.interface';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { sanitizeBaseName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { ensureCapability } from '../tool-guard';
import { assertBatchCount, BatchProcessor } from '../batch-processor';

export const OFFICE_EXTENSIONS: readonly OfficeExtension[] = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];
export const OFFICE_BATCH_ZIP_NAME = 'convertidos.zip';

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
    private readonly batch: BatchProcessor,
  ) {}

  async execute(input: { files: InputFile[]; signal?: AbortSignal }): Promise<PdfToolResult> {
    assertBatchCount(input.files, PDF_TOOLS_LIMITS.officeBatchMaxFiles, 'documentos');
    const many = input.files.length > 1;
    // Extensao de TODOS antes de checar o LibreOffice (erro 400 tem prioridade).
    const extensions = input.files.map((file) => {
      const extension = officeExtensionOf(file.originalname);
      if (!extension) {
        const msg = `Formato não suportado. Envie um arquivo ${OFFICE_EXTENSIONS.join(', ')}.`;
        throw invalidInput(many ? `"${file.originalname}": ${msg}` : msg);
      }
      return extension;
    });
    await ensureCapability(this.availability, 'office');

    const results = await this.batch.run(input.files, {
      validate: async (_file, i) => extensions[i],
      process: async (file, extension, _i, budget): Promise<PdfToolResult> => {
        const data = await (budget
          ? this.converter.convertToPdf({ buffer: file.buffer, extension }, budget)
          : this.converter.convertToPdf({ buffer: file.buffer, extension }));
        const pages = await this.engine.getPageCount(data);
        return {
          data,
          fileName: `${sanitizeBaseName(file.originalname)}.pdf`,
          contentType: CONTENT_TYPES.pdf,
          meta: { pages, originalSize: file.buffer.length, resultSize: data.length },
        };
      },
    }, { signal: input.signal });
    return results.length === 1 ? results[0] : this.batch.zipResults(results, OFFICE_BATCH_ZIP_NAME, ['pages']);
  }
}
