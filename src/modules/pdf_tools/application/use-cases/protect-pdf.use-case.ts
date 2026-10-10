// src/modules/pdf_tools/application/use-cases/protect-pdf.use-case.ts
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

@Injectable()
export class ProtectPdfUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfSecurity') private readonly security: IPdfSecurity,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
  ) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
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

    // Ja protegido -> 422 ENCRYPTED_PDF (pdf-lib recusa carregar).
    const pages = await this.engine.getPageCount(input.file.buffer);
    const data = await this.security.protect(input.file.buffer, { password, allowPrint, allowCopy });
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'protegido', 'pdf'),
      contentType: CONTENT_TYPES.pdf,
      meta: { pages, originalSize: input.file.buffer.length, resultSize: data.length },
    };
  }
}
