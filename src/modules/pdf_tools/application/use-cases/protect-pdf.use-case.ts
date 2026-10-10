// src/modules/pdf_tools/application/use-cases/protect-pdf.use-case.ts
// 1 a 20 PDFs, a MESMA senha/permissoes para todos. Lote -> protegidos.zip.
// A senha nunca e logada nem devolvida no meta.
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfSecurity } from '../../domain/services/pdf-security.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readBoolean, readString } from '../options';
import { ensureCapability } from '../tool-guard';
import { assertBatchCount, BatchProcessor } from '../batch-processor';

export const PROTECT_BATCH_ZIP_NAME = 'protegidos.zip';

@Injectable()
export class ProtectPdfUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfSecurity') private readonly security: IPdfSecurity,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
    private readonly batch: BatchProcessor,
  ) {}

  async execute(input: { files: InputFile[]; options: unknown; signal?: AbortSignal }): Promise<PdfToolResult> {
    assertBatchCount(input.files, PDF_TOOLS_LIMITS.batchMaxFiles, 'PDFs');
    const options = parseOptions(input.options);
    const password = readString(options, 'password', 'a senha', {
      min: PDF_TOOLS_LIMITS.passwordMin,
      max: PDF_TOOLS_LIMITS.passwordMax,
    })!;
    // Quebra de linha/caracteres de controle quebrariam o arquivo de
    // argumentos do qpdf (1 argumento por linha) - rejeita.
    if (/[\u0000-\u001f\u007f]/.test(password)) {
      throw invalidInput('A senha não pode conter quebras de linha ou caracteres de controle.');
    }
    const allowPrint = readBoolean(options, 'allowPrint', 'permitir impressão', true);
    const allowCopy = readBoolean(options, 'allowCopy', 'permitir cópia', false);
    await ensureCapability(this.availability, 'security');

    const results = await this.batch.run(input.files, {
      // Ja protegido -> 422 ENCRYPTED_PDF (pdf-lib recusa carregar).
      validate: (file) => this.engine.getPageCount(file.buffer),
      weight: (pages) => pages,
      process: async (file, pages, _i, budget): Promise<PdfToolResult> => {
        const data = await (budget
          ? this.security.protect(file.buffer, { password, allowPrint, allowCopy }, budget)
          : this.security.protect(file.buffer, { password, allowPrint, allowCopy }));
        return {
          data,
          fileName: buildOutputFileName(file.originalname, 'protegido', 'pdf'),
          contentType: CONTENT_TYPES.pdf,
          meta: { pages, originalSize: file.buffer.length, resultSize: data.length },
        };
      },
    }, { signal: input.signal });
    return results.length === 1 ? results[0] : this.batch.zipResults(results, PROTECT_BATCH_ZIP_NAME, ['pages']);
  }
}
