// src/modules/pdf_tools/infra/services/pdf-parse-rasterizer.service.ts
// PDF -> imagem via pdf-parse (pdfjs) getScreenshot + @napi-rs/canvas.
// Renderizar usa muita CPU/memoria na thread principal: fila de UM render
// por vez neste processo, e uma pagina por vez dentro do render.
import { Injectable } from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import { IPdfRasterizer, RasterDpi, RasterFormat, RasterPage } from '../../domain/services/pdf-rasterizer.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { ConcurrencyQueue } from './process-runner';

const queue = new ConcurrencyQueue(1);
// Teto de pixels por imagem (~24 MP), protege contra paginas gigantes.
const MAX_PIXELS = 24_000_000;
const MAX_SIDE = 12_000;
const JPEG_QUALITY = 88;

@Injectable()
export class PdfParseRasterizerService implements IPdfRasterizer {
  render(pdf: Buffer, indices: number[], options: { format: RasterFormat; dpi: RasterDpi }): Promise<RasterPage[]> {
    return queue.run(() => this.renderAll(pdf, indices, options));
  }

  private async renderAll(
    pdf: Buffer,
    indices: number[],
    options: { format: RasterFormat; dpi: RasterDpi },
  ): Promise<RasterPage[]> {
    const widths = await this.targetWidths(pdf, indices, options.dpi);
    // pdfjs pode "consumir" (transferir) o buffer - sempre uma copia.
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    const out: RasterPage[] = [];
    try {
      for (const index of indices) {
        const desiredWidth = widths.get(index);
        if (!desiredWidth) continue;
        const encoded = await this.renderPage(parser, index + 1, desiredWidth, options.format);
        if (encoded) out.push({ page: index + 1, data: encoded });
      }
      return out;
    } catch (error) {
      if (error instanceof PdfToolsError) throw error;
      throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível converter o PDF em imagem.');
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  /**
   * Renderiza UMA pagina e devolve so a imagem final comprimida. Todos os
   * intermediarios (resultado do pdfjs, PNG bruto, bitmap decodificado e
   * canvas) ficam no escopo desta funcao e sao soltos ao retornar - nenhum
   * bitmap de pagina sobrevive ate a proxima iteracao.
   */
  private async renderPage(
    parser: PDFParse,
    pageNumber: number,
    desiredWidth: number,
    format: RasterFormat,
  ): Promise<Buffer | null> {
    let shots: Awaited<ReturnType<PDFParse['getScreenshot']>> | null = await parser.getScreenshot({
      partial: [pageNumber],
      desiredWidth,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const shot = shots.pages[0];
    shots = null;
    if (!shot) return null;
    // Visao sobre os mesmos bytes (sem copia) do PNG gerado pelo pdfjs.
    const png = Buffer.from(shot.data.buffer, shot.data.byteOffset, shot.data.byteLength);
    if (format === 'png') return Buffer.from(png); // copia compacta do PNG final
    let image: Awaited<ReturnType<typeof loadImage>> | null = await loadImage(png);
    const { width, height } = image;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // JPEG nao tem transparencia
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0);
    image = null; // bitmap decodificado ja foi desenhado: libera antes do encode
    const jpeg = await canvas.encode('jpeg', JPEG_QUALITY);
    // Reduz o canvas a 1x1 para o bitmap nativo ser liberado imediatamente
    // (sem esperar o GC finalizar o objeto JS).
    canvas.width = 1;
    canvas.height = 1;
    return jpeg;
  }

  /** Largura em px de cada pagina para o DPI pedido (1 pt = 1/72 pol). */
  private async targetWidths(pdf: Buffer, indices: number[], dpi: RasterDpi): Promise<Map<number, number>> {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(pdf, { updateMetadata: false });
    } catch {
      throw new PdfToolsError('INVALID_INPUT', 'Não foi possível ler o PDF.');
    }
    const scale = dpi / 72;
    const map = new Map<number, number>();
    for (const index of indices) {
      if (index < 0 || index >= doc.getPageCount()) continue;
      const page = doc.getPage(index);
      let { width, height } = page.getSize();
      if (page.getRotation().angle % 180 !== 0) [width, height] = [height, width];
      if (!(width > 0 && height > 0)) continue;
      let w = width * scale;
      let h = height * scale;
      const shrink = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)), MAX_SIDE / Math.max(w, h));
      w *= shrink;
      h *= shrink;
      map.set(index, Math.max(1, Math.round(w)));
    }
    return map;
  }
}
