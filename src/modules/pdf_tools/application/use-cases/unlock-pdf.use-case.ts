// src/modules/pdf_tools/application/use-cases/unlock-pdf.use-case.ts
// 1 a 20 PDFs, a MESMA senha para todos. Lote -> desbloqueados.zip; senha
// errada em qualquer arquivo aborta o lote dizendo qual ("Senha incorreta
// para "x.pdf""). Nao ha validacao previa barata: so o qpdf sabe se a
// senha confere, entao a checagem acontece no proprio desbloqueio.
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfSecurity } from '../../domain/services/pdf-security.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readString } from '../options';
import { ensureCapability } from '../tool-guard';
import { assertBatchCount, BatchProcessor } from '../batch-processor';

export const UNLOCK_BATCH_ZIP_NAME = 'desbloqueados.zip';

@Injectable()
export class UnlockPdfUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfSecurity') private readonly security: IPdfSecurity,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
    private readonly batch: BatchProcessor,
  ) {}

  async execute(input: { files: InputFile[]; options: unknown; signal?: AbortSignal }): Promise<PdfToolResult> {
    assertBatchCount(input.files, PDF_TOOLS_LIMITS.batchMaxFiles, 'PDFs');
    const options = parseOptions(input.options);
    // Senha de abertura pode ser vazia (PDF so com restricao de permissao).
    const password = readString(options, 'password', 'a senha', { min: 0, max: 128 }) ?? '';
    if (/[\u0000-\u001f\u007f]/.test(password)) {
      throw invalidInput('A senha não pode conter quebras de linha ou caracteres de controle.');
    }
    await ensureCapability(this.availability, 'security');

    const results = await this.batch.run(input.files, {
      process: async (file, _v, _i, budget): Promise<PdfToolResult> => {
        const data = await (budget ? this.security.unlock(file.buffer, password, budget) : this.security.unlock(file.buffer, password));
        const pages = await this.engine.getPageCount(data);
        return {
          data,
          fileName: buildOutputFileName(file.originalname, 'desbloqueado', 'pdf'),
          contentType: CONTENT_TYPES.pdf,
          meta: { pages, originalSize: file.buffer.length, resultSize: data.length },
        };
      },
    }, { signal: input.signal });
    return results.length === 1 ? results[0] : this.batch.zipResults(results, UNLOCK_BATCH_ZIP_NAME, ['pages']);
  }
}
