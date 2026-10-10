// src/modules/pdf_tools/infra/services/ghostscript-compressor.service.ts
// Compressao via Ghostscript (pdfwrite). -dSAFER impede o PostScript do
// arquivo de acessar o sistema de arquivos.
import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { CompressionLevel, IPdfCompressor } from '../../domain/services/pdf-compressor.interface';
import { ProcessTimeoutOptions } from '../../domain/services/office-converter.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { ghostscriptPath } from './binary-paths';
import { abortedError, BinaryNotFoundError, ConcurrencyQueue, runProcess, timeBudget } from './process-runner';
import { fileExists, withTempDir } from './temp-workspace';

const COMPRESS_TIMEOUT_MS = 120_000;
const queue = new ConcurrencyQueue(2);

const PDF_SETTINGS: Record<CompressionLevel, string> = {
  leve: '/printer',
  recomendada: '/ebook',
  extrema: '/screen',
};

@Injectable()
export class GhostscriptCompressorService implements IPdfCompressor {
  private readonly logger = new Logger(GhostscriptCompressorService.name);

  compress(pdf: Buffer, level: CompressionLevel, options?: ProcessTimeoutOptions): Promise<Buffer> {
    const budget = timeBudget(COMPRESS_TIMEOUT_MS, options?.timeoutMs);
    return queue.run(() =>
      withTempDir('gs', async (dir) => {
        if (options?.signal?.aborted) throw abortedError();
        const inputPath = path.join(dir, 'entrada.pdf');
        const outputPath = path.join(dir, 'saida.pdf');
        await fs.writeFile(inputPath, pdf, { mode: 0o600 });

        const args = [
          '-dSAFER',
          '-dBATCH',
          '-dNOPAUSE',
          '-dQUIET',
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.5',
          `-dPDFSETTINGS=${PDF_SETTINGS[level]}`,
          '-dDetectDuplicateImages=true',
          '-dCompressFonts=true',
          `-sOutputFile=${outputPath}`,
          inputPath,
        ];
        let result;
        try {
          result = await runProcess(ghostscriptPath(), args, { timeoutMs: budget(), cwd: dir, signal: options?.signal });
        } catch (error) {
          if (error instanceof BinaryNotFoundError) {
            throw new PdfToolsError('TOOL_UNAVAILABLE', 'A compressão de PDF não está disponível neste servidor.');
          }
          this.logger.error(`gs falhou ao iniciar: ${error instanceof Error ? error.message : error}`);
          throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível comprimir o PDF.');
        }
        if (result.aborted) throw abortedError();
        if (result.timedOut) {
          throw new PdfToolsError('PROCESSING_FAILED', 'A compressão demorou demais e foi cancelada. Tente um arquivo menor.');
        }
        if (result.code !== 0 || !(await fileExists(outputPath))) {
          this.logger.warn(`gs terminou com codigo ${result.code}: ${result.stderr.slice(0, 500)}`);
          throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível comprimir o PDF. Verifique se o arquivo não está corrompido.');
        }
        return fs.readFile(outputPath);
      }),
    );
  }
}
