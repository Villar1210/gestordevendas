// src/modules/pdf_tools/infra/services/libreoffice-office-converter.service.ts
// Conversao Office -> PDF via LibreOffice headless. Proprio do modulo
// pdf_tools (NAO reaproveita o servico do edoc, para manter o modulo
// isolado). Cada execucao usa um perfil de usuario descartavel
// (-env:UserInstallation) - permite rodar conversoes em paralelo sem o
// lock do perfil padrao e nao deixa rastros no HOME do servidor.
import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { IOfficeConverter, OfficeExtension } from '../../domain/services/office-converter.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { sofficePath } from './binary-paths';
import { BinaryNotFoundError, ConcurrencyQueue, runProcess } from './process-runner';
import { fileExists, withTempDir } from './temp-workspace';

const CONVERT_TIMEOUT_MS = 90_000;

// Configuracao gravada no perfil descartavel ANTES de cada conversao.
// Caminhos/nomes conferidos no esquema do LibreOffice instalado
// (share/registry/main.xcd):
// - Common/Security/Scripting/MacroSecurityLevel = 3 ("muito alta": so
//   macros de locais confiaveis assinados - nenhum aqui) e
//   DisableMacrosExecution = true (desliga Basic/Python/JS por completo);
// - Writer/Content/Update/Link e Calc/Content/Update/Link = 2 ("nunca"):
//   nao busca links/arquivos externos (SSRF/leitura de arquivo local)
//   ao abrir o documento.
const REGISTRY_MODIFICATIONS = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item>
</oor:items>
`;
// LibreOffice e pesado (CPU/RAM): no maximo 2 conversoes simultaneas.
const queue = new ConcurrencyQueue(2);

@Injectable()
export class LibreOfficeOfficeConverterService implements IOfficeConverter {
  private readonly logger = new Logger(LibreOfficeOfficeConverterService.name);

  convertToPdf(input: { buffer: Buffer; extension: OfficeExtension }): Promise<Buffer> {
    return queue.run(() => this.convert(input));
  }

  private async convert(input: { buffer: Buffer; extension: OfficeExtension }): Promise<Buffer> {
    return withTempDir('office', async (dir) => {
      const outDir = path.join(dir, 'out');
      const profileDir = path.join(dir, 'lo-profile');
      await fs.mkdir(outDir, { mode: 0o700 });
      await fs.mkdir(profileDir, { mode: 0o700 });
      await fs.mkdir(path.join(profileDir, 'user'), { mode: 0o700 });
      await fs.writeFile(path.join(profileDir, 'user', 'registrymodifications.xcu'), REGISTRY_MODIFICATIONS, { mode: 0o600 });
      // Nome fixo: nada do nome enviado pelo usuario chega ao argv.
      const inputPath = path.join(dir, `documento.${input.extension}`);
      await fs.writeFile(inputPath, input.buffer, { mode: 0o600 });

      const args = [
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--headless',
        '--invisible',
        '--nologo',
        '--nodefault',
        '--norestore',
        '--nolockcheck',
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        inputPath,
      ];
      const started = Date.now();
      let result;
      try {
        result = await runProcess(sofficePath(), args, {
          timeoutMs: CONVERT_TIMEOUT_MS,
          cwd: dir,
          env: { ...process.env, HOME: dir },
        });
      } catch (error) {
        if (error instanceof BinaryNotFoundError) {
          throw new PdfToolsError('TOOL_UNAVAILABLE', 'A conversão de documentos Office não está disponível neste servidor.');
        }
        this.logger.error(`soffice falhou ao iniciar: ${error instanceof Error ? error.message : error}`);
        throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível converter o documento para PDF.');
      }

      const outputPath = path.join(outDir, 'documento.pdf');
      if (result.timedOut) {
        this.logger.warn(`soffice excedeu ${CONVERT_TIMEOUT_MS / 1000}s e foi encerrado.`);
        throw new PdfToolsError('PROCESSING_FAILED', 'A conversão demorou demais e foi cancelada. Tente um arquivo menor.');
      }
      if (result.code !== 0 || !(await fileExists(outputPath))) {
        this.logger.warn(
          `soffice terminou sem gerar PDF (codigo ${result.code}, ${Date.now() - started}ms): ${result.stderr.slice(0, 500)}`,
        );
        throw new PdfToolsError(
          'PROCESSING_FAILED',
          'Não foi possível converter o documento para PDF. Verifique se o arquivo não está corrompido ou protegido por senha.',
        );
      }
      return fs.readFile(outputPath);
    });
  }
}
