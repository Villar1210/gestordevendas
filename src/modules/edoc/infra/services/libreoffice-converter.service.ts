// src/modules/edoc/infra/services/libreoffice-converter.service.ts
// Camada de INFRA: chama o binario do LibreOffice via child_process. So
// esta classe conhece a existencia do LibreOffice/soffice - o resto do
// modulo (use cases) so ve IDocumentConverterService.
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IDocumentConverterService } from '../../domain/services/document-converter.interface';

// Timeout defensivo: uma conversao normal leva poucos segundos, mas o
// soffice pode "pendurar" esperando uma janela/dialogo caso alguma flag
// de --headless nao seja respeitada por algum motivo (visto na pratica
// durante a verificacao manual desta fatia) - melhor matar o processo e
// falhar com um erro claro do que travar a requisicao para sempre.
const CONVERT_TIMEOUT_MS = 60_000;

function resolveSofficePath(): string {
  if (process.env.LIBREOFFICE_PATH) {
    return process.env.LIBREOFFICE_PATH;
  }
  // Fallback sensato por sistema operacional - instalacao padrao do
  // LibreOffice no Windows nao entra no PATH automaticamente; no Linux
  // (VPS de producao, `apt install libreoffice`) o binario "soffice" ja
  // fica disponivel no PATH.
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
  }
  return 'soffice';
}

@Injectable()
export class LibreOfficeConverterService implements IDocumentConverterService {
  private readonly logger = new Logger(LibreOfficeConverterService.name);

  async convertToPdf(input: { buffer: Buffer; originalname: string }): Promise<Buffer> {
    const sofficePath = resolveSofficePath();
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edoc-convert-'));
    const extension = path.extname(input.originalname) || '.docx';
    const inputPath = path.join(tmpDir, `documento${extension}`);

    try {
      await fs.writeFile(inputPath, input.buffer);
      await this.runSoffice(sofficePath, tmpDir, inputPath);
      const outputPath = path.join(tmpDir, 'documento.pdf');
      return await fs.readFile(outputPath);
    } catch (error) {
      this.logger.error(
        `Falha ao converter "${input.originalname}" para PDF: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new InternalServerErrorException(
        'Nao foi possivel converter o documento para PDF. Verifique se o arquivo nao esta corrompido.',
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private runSoffice(sofficePath: string, outDir: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(sofficePath, [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        filePath,
      ]);

      let stderr = '';
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error(`Conversao excedeu o tempo limite de ${CONVERT_TIMEOUT_MS / 1000}s.`));
      }, CONVERT_TIMEOUT_MS);

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(err);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`soffice saiu com codigo ${code}: ${stderr}`));
        }
      });
    });
  }
}
