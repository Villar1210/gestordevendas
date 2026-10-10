// src/modules/pdf_tools/infra/services/qpdf-security.service.ts
// Protecao/desbloqueio via qpdf. A SENHA NUNCA VAI PARA O ARGV (visivel
// em `ps`/proc para qualquer usuario do servidor) nem para log: os
// argumentos sensiveis vao num arquivo `@argsfile` (1 argumento por
// linha, recurso nativo do qpdf), criado com permissao 600 dentro de uma
// pasta mkdtemp 700 e apagado no finally junto com a pasta.
import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IPdfSecurity, ProtectOptions } from '../../domain/services/pdf-security.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { qpdfPath } from './binary-paths';
import { BinaryNotFoundError, ConcurrencyQueue, ProcessResult, runProcess } from './process-runner';
import { fileExists, withTempDir } from './temp-workspace';

const QPDF_TIMEOUT_MS = 60_000;
const queue = new ConcurrencyQueue(2);

function assertSafeArgLine(value: string): void {
  // O @argsfile e lido linha a linha - quebra de linha separaria argumentos.
  if (/[\r\n\u0000]/.test(value)) {
    throw new PdfToolsError('INVALID_INPUT', 'A senha não pode conter quebras de linha.');
  }
}

@Injectable()
export class QpdfSecurityService implements IPdfSecurity {
  private readonly logger = new Logger(QpdfSecurityService.name);

  protect(pdf: Buffer, options: ProtectOptions): Promise<Buffer> {
    assertSafeArgLine(options.password);
    // Senha de proprietario aleatoria (nunca devolvida): quem so tem a
    // senha de abertura nao consegue remover as restricoes de permissao.
    const ownerPassword = randomBytes(24).toString('base64url');
    // Sintaxe NOMEADA (--user-password=...): na forma posicional, uma senha
    // comecando com "-" seria lida pelo qpdf como opcao e o protect falharia.
    const lines = [
      '--encrypt',
      `--user-password=${options.password}`,
      `--owner-password=${ownerPassword}`,
      '--bits=256',
      `--print=${options.allowPrint ? 'full' : 'none'}`,
      `--extract=${options.allowCopy ? 'y' : 'n'}`,
      '--',
    ];
    return this.run(pdf, lines, 'protect');
  }

  unlock(pdf: Buffer, password: string): Promise<Buffer> {
    assertSafeArgLine(password);
    const lines = [`--password=${password}`, '--decrypt'];
    return this.run(pdf, lines, 'unlock');
  }

  private run(pdf: Buffer, secretArgs: string[], operation: 'protect' | 'unlock'): Promise<Buffer> {
    return queue.run(() =>
      withTempDir('qpdf', async (dir) => {
        const inputPath = path.join(dir, 'entrada.pdf');
        const outputPath = path.join(dir, 'saida.pdf');
        const argsFile = path.join(dir, 'args.txt');
        await fs.writeFile(inputPath, pdf, { mode: 0o600 });
        // flag "wx": falha se ja existir (nao segue symlink pre-existente)
        await fs.writeFile(argsFile, `${secretArgs.join('\n')}\n`, { mode: 0o600, flag: 'wx' });
        await fs.chmod(argsFile, 0o600);

        let result: ProcessResult;
        try {
          result = await runProcess(qpdfPath(), [`@${argsFile}`, inputPath, outputPath], {
            timeoutMs: QPDF_TIMEOUT_MS,
            cwd: dir,
          });
        } catch (error) {
          if (error instanceof BinaryNotFoundError) {
            throw new PdfToolsError('TOOL_UNAVAILABLE', 'A proteção de PDF não está disponível neste servidor.');
          } // nunca loga argumentos (contem a senha)
          this.logger.error(`qpdf (${operation}) falhou ao iniciar.`);
          throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível processar o PDF.');
        } finally {
          // Apaga o arquivo de argumentos assim que o qpdf termina (a pasta
          // inteira tambem e removida no finally de withTempDir).
          await fs.rm(argsFile, { force: true }).catch(() => undefined);
        }

        if (result.timedOut) {
          throw new PdfToolsError('PROCESSING_FAILED', 'O processamento demorou demais e foi cancelado.');
        }
        const stderr = result.stderr.toLowerCase();
        if (operation === 'unlock' && stderr.includes('invalid password')) {
          throw new PdfToolsError('WRONG_PASSWORD', 'Senha incorreta. Confira a senha e tente novamente.');
        }
        // 0 = ok, 3 = ok com avisos (arquivo gerado)
        if ((result.code !== 0 && result.code !== 3) || !(await fileExists(outputPath))) {
          // stderr do qpdf nao contem a senha (ela so esta no argsfile),
          // mas por precaucao loga so o codigo de saida.
          this.logger.warn(`qpdf (${operation}) terminou com codigo ${result.code}.`);
          throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível processar o PDF. Verifique se o arquivo não está corrompido.');
        }
        return fs.readFile(outputPath);
      }),
    );
  }
}
