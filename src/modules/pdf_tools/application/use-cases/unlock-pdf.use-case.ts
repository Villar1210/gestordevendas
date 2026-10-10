// src/modules/pdf_tools/application/use-cases/unlock-pdf.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfSecurity } from '../../domain/services/pdf-security.interface';
import { IToolAvailability } from '../../domain/services/tool-availability.interface';
import { invalidInput } from '../../domain/pdf-tools.errors';
import { buildOutputFileName } from '../../domain/file-name';
import { CONTENT_TYPES, InputFile, PdfToolResult } from '../pdf-tool.types';
import { parseOptions, readString } from '../options';
import { ensureCapability } from '../tool-guard';

@Injectable()
export class UnlockPdfUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfSecurity') private readonly security: IPdfSecurity,
    @Inject('IToolAvailability') private readonly availability: IToolAvailability,
  ) {}

  async execute(input: { file: InputFile; options: unknown }): Promise<PdfToolResult> {
    const options = parseOptions(input.options);
    // Senha de abertura pode ser vazia (PDF so com restricao de permissao).
    const password = readString(options, 'password', 'a senha', { min: 0, max: 128 }) ?? '';
    if (/[\u0000-\u001f\u007f]/.test(password)) {
      throw invalidInput('A senha não pode conter quebras de linha ou caracteres de controle.');
    }
    await ensureCapability(this.availability, 'security');

    const data = await this.security.unlock(input.file.buffer, password);
    const pages = await this.engine.getPageCount(data);
    return {
      data,
      fileName: buildOutputFileName(input.file.originalname, 'desbloqueado', 'pdf'),
      contentType: CONTENT_TYPES.pdf,
      meta: { pages, originalSize: input.file.buffer.length, resultSize: data.length },
    };
  }
}
