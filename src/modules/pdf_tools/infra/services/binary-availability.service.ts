// src/modules/pdf_tools/infra/services/binary-availability.service.ts
// Descobre quais ferramentas dependentes de binario existem no servidor
// (`<binario> --version`), com cache de 5 minutos. Assim a VPS sem
// qpdf/gs responde 503 claro e o frontend esmaece os cards.
import { Injectable, Logger } from '@nestjs/common';
import { IToolAvailability, PdfToolCapability, PdfToolsCapabilities } from '../../domain/services/tool-availability.interface';
import { ghostscriptPath, qpdfPath, sofficePath } from './binary-paths';
import { runProcess } from './process-runner';

const CACHE_TTL_MS = 5 * 60_000;
const PROBE_TIMEOUT_MS = 20_000;

@Injectable()
export class BinaryAvailabilityService implements IToolAvailability {
  private readonly logger = new Logger(BinaryAvailabilityService.name);
  private cache: { value: PdfToolsCapabilities; expiresAt: number } | null = null;
  private inFlight: Promise<PdfToolsCapabilities> | null = null;

  async getCapabilities(): Promise<PdfToolsCapabilities> {
    if (this.cache && this.cache.expiresAt > Date.now()) return { ...this.cache.value };
    if (!this.inFlight) {
      this.inFlight = this.probeAll().finally(() => {
        this.inFlight = null;
      });
    }
    return { ...(await this.inFlight) };
  }

  async isAvailable(capability: PdfToolCapability): Promise<boolean> {
    return (await this.getCapabilities())[capability];
  }

  private async probeAll(): Promise<PdfToolsCapabilities> {
    const [office, compress, security, raster] = await Promise.all([
      this.probe(sofficePath(), ['--headless', '--version']),
      this.probe(ghostscriptPath(), ['--version']),
      this.probe(qpdfPath(), ['--version']),
      this.probeRaster(),
    ]);
    const value = { office, compress, security, raster };
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    this.logger.log(`Capacidades das Ferramentas PDF: ${JSON.stringify(value)}`);
    return value;
  }

  private async probe(command: string, args: string[]): Promise<boolean> {
    try {
      const result = await runProcess(command, args, { timeoutMs: PROBE_TIMEOUT_MS });
      return result.code === 0 && !result.timedOut;
    } catch {
      return false;
    }
  }

  private async probeRaster(): Promise<boolean> {
    try {
      // @napi-rs/canvas e binario nativo: confirma que carrega nesta maquina.
      const { createCanvas } = await import('@napi-rs/canvas');
      createCanvas(1, 1);
      return true;
    } catch {
      return false;
    }
  }
}
