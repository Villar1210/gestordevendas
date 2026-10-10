// src/modules/pdf_tools/infra/services/pdf-lib-engine.service.ts
// Camada de INFRA: unico lugar do modulo que conhece o pdf-lib. Faz as
// operacoes "puras" de PDF (juntar, dividir, organizar, girar, numerar,
// marca d'agua, imagens -> PDF, criar PDF de texto).
//
// Fontes padrao (StandardFonts) usam a codificacao WinAnsi: todo texto
// desenhado passa por toWinAnsi(), que troca caracteres fora do conjunto
// da fonte (emoji etc.) por "?" - acentos do portugues sao suportados.
import { Injectable } from '@nestjs/common';
import {
  degrees,
  EncryptedPDFError,
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import {
  CreateTextPdfOptions,
  ImageInput,
  ImagesToPdfOptions,
  IPdfEngine,
  PageArrangement,
  PageNumberOptions,
  RotationAngle,
  WatermarkOptions,
} from '../../domain/services/pdf-engine.interface';
import { MENSAGEM_PDF_PROTEGIDO, PdfToolsError } from '../../domain/pdf-tools.errors';
import { MAX_IMAGE_PIXELS, readImageDimensions } from '../../domain/image-dimensions';

const PAGE_SIZES = {
  A4: [595.28, 841.89] as [number, number],
  Carta: [612, 792] as [number, number],
};
const IMAGE_MARGINS = { nenhuma: 0, pequena: 20, grande: 50 };
const WATERMARK_SIZES = { pequeno: 36, medio: 60, grande: 90 };
// Limite da especificacao PDF para dimensao de pagina (200 polegadas).
const MAX_PAGE_POINTS = 14_400;

// ---------------------------------------------------------------------------
// Helpers de texto
// ---------------------------------------------------------------------------

const charsetCache = new WeakMap<PDFFont, Set<number>>();

/** Troca caracteres que a fonte padrao (WinAnsi) nao suporta por "?". */
export function toWinAnsi(text: string, font: PDFFont): string {
  let charset = charsetCache.get(font);
  if (!charset) {
    charset = new Set(font.getCharacterSet());
    charsetCache.set(font, charset);
  }
  const normalized = text.normalize('NFC').replace(/\t/g, '    ').replace(/[\r\n]/g, ' ');
  let out = '';
  for (const ch of normalized) {
    const cp = ch.codePointAt(0)!;
    if (charset.has(cp)) out += ch;
    else if (cp === 0x00a0) out += ' ';
    else out += '?';
  }
  return out;
}

/** Quebra um paragrafo em linhas que cabem em maxWidth. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const width = (s: string) => font.widthOfTextAtSize(s, size);
  const words = text.split(/ +/).filter((w) => w !== '');
  const lines: string[] = [];
  let current = '';

  const pushLongWord = (word: string) => {
    // Palavra maior que a linha inteira: quebra por caractere.
    let chunk = '';
    for (const ch of word) {
      if (chunk && width(chunk + ch) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (width(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = width(word) > maxWidth ? pushLongWord(word) : word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// ---------------------------------------------------------------------------
// Geometria: desenhar no "espaco visual" de uma pagina com /Rotate
// ---------------------------------------------------------------------------

interface VisualFrame {
  width: number; // largura como o usuario ve a pagina
  height: number;
  /** ponto visual (origem no canto inferior esquerdo visto) -> espaco do PDF */
  toUser(vx: number, vy: number): { x: number; y: number };
  rotation: number; // rotacao da pagina (0/90/180/270)
}

function visualFrame(page: PDFPage): VisualFrame {
  const box = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const { x: ox, y: oy, width: w, height: h } = box;
  const swap = rotation === 90 || rotation === 270;
  return {
    width: swap ? h : w,
    height: swap ? w : h,
    rotation,
    toUser(vx, vy) {
      switch (rotation) {
        case 90:
          return { x: ox + w - vy, y: oy + vx };
        case 180:
          return { x: ox + w - vx, y: oy + h - vy };
        case 270:
          return { x: ox + vy, y: oy + h - vx };
        default:
          return { x: ox + vx, y: oy + vy };
      }
    },
  };
}

/** Desenha texto cuja linha de base comeca no ponto visual (vx,vy), girado `angle` graus (anti-horario) visualmente. */
function drawVisualText(
  page: PDFPage,
  frame: VisualFrame,
  text: string,
  opts: { vx: number; vy: number; angle?: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; opacity?: number },
): void {
  const { x, y } = frame.toUser(opts.vx, opts.vy);
  page.drawText(text, {
    x,
    y,
    font: opts.font,
    size: opts.size,
    color: opts.color,
    opacity: opts.opacity,
    rotate: degrees(((opts.angle ?? 0) + frame.rotation) % 360),
  });
}

// ---------------------------------------------------------------------------

@Injectable()
export class PdfLibEngineService implements IPdfEngine {
  async getPageCount(pdf: Buffer): Promise<number> {
    const doc = await this.load(pdf);
    return doc.getPageCount();
  }

  async merge(pdfs: Buffer[]): Promise<Buffer> {
    const sources: PDFDocument[] = [];
    for (const pdf of pdfs) sources.push(await this.load(pdf));
    return this.guard(async () => {
      const out = await PDFDocument.create();
      for (const src of sources) {
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      return this.save(out);
    });
  }

  async extractPages(pdf: Buffer, indices: number[]): Promise<Buffer> {
    const src = await this.load(pdf);
    return this.guard(async () => this.save(await this.copyInto(src, indices)));
  }

  async splitGroups(pdf: Buffer, groups: number[][]): Promise<Buffer[]> {
    const src = await this.load(pdf);
    return this.guard(async () => {
      const parts: Buffer[] = [];
      for (const group of groups) parts.push(await this.save(await this.copyInto(src, group)));
      return parts;
    });
  }

  async organize(pdf: Buffer, arrangement: PageArrangement[]): Promise<Buffer> {
    const src = await this.load(pdf);
    return this.guard(async () => {
      const out = await this.copyInto(
        src,
        arrangement.map((a) => a.index),
      );
      out.getPages().forEach((page, i) => {
        const extra = arrangement[i].rotate;
        if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
      });
      return this.save(out);
    });
  }

  async rotate(pdf: Buffer, angle: Exclude<RotationAngle, 0>, indices: number[] | null): Promise<Buffer> {
    const doc = await this.load(pdf);
    return this.guard(async () => {
      const pages = doc.getPages();
      const targets = indices ?? pages.map((_, i) => i);
      for (const i of targets) {
        const page = pages[i];
        page.setRotation(degrees((((page.getRotation().angle + angle) % 360) + 360) % 360));
      }
      return this.save(doc);
    });
  }

  async addPageNumbers(pdf: Buffer, options: PageNumberOptions): Promise<Buffer> {
    const doc = await this.load(pdf);
    return this.guard(async () => {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const firstNumbered = options.skipFirst ? 1 : 0;
      const numberedCount = pages.length - firstNumbered;
      const lastNumber = options.startAt + numberedCount - 1;

      pages.forEach((page, i) => {
        if (i < firstNumbered) return;
        const n = options.startAt + (i - firstNumbered);
        const label =
          options.format === 'n-de-total'
            ? `${n} de ${lastNumber}`
            : options.format === 'pagina-n'
              ? `Página ${n}`
              : `${n}`;
        const text = toWinAnsi(label, font);
        const frame = visualFrame(page);
        const size = Math.max(7, Math.min(11, frame.width / 55));
        const textWidth = font.widthOfTextAtSize(text, size);
        const margin = Math.max(18, Math.min(36, frame.width * 0.05));
        const vx =
          options.position === 'inferior-centro' ? (frame.width - textWidth) / 2 : frame.width - margin - textWidth;
        const vy = options.position === 'superior-direita' ? frame.height - margin - size : margin;
        drawVisualText(page, frame, text, { vx, vy, font, size, color: rgb(0.2, 0.2, 0.2) });
      });
      return this.save(doc);
    });
  }

  async addWatermark(pdf: Buffer, options: WatermarkOptions): Promise<Buffer> {
    const doc = await this.load(pdf);
    return this.guard(async () => {
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const text = toWinAnsi(options.text, font);
      for (const page of doc.getPages()) {
        const frame = visualFrame(page);
        const angleDeg = options.diagonal ? (Math.atan2(frame.height, frame.width) * 180) / Math.PI : 0;
        const available = options.diagonal ? Math.hypot(frame.width, frame.height) * 0.8 : frame.width * 0.85;
        const widthAt1 = font.widthOfTextAtSize(text, 1) || 1;
        const size = Math.max(8, Math.min(WATERMARK_SIZES[options.size], available / widthAt1));
        const textWidth = font.widthOfTextAtSize(text, size);
        const capHeight = font.heightAtSize(size, { descender: false });
        const a = (angleDeg * Math.PI) / 180;
        const cx = frame.width / 2;
        const cy = frame.height / 2;
        // Centraliza: recua metade da largura ao longo do texto e metade da
        // altura na perpendicular.
        const vx = cx - (textWidth / 2) * Math.cos(a) + (capHeight / 2) * Math.sin(a);
        const vy = cy - (textWidth / 2) * Math.sin(a) - (capHeight / 2) * Math.cos(a);
        drawVisualText(page, frame, text, {
          vx,
          vy,
          angle: angleDeg,
          font,
          size,
          color: rgb(0.5, 0.5, 0.5),
          opacity: options.opacity,
        });
      }
      return this.save(doc);
    });
  }

  async imagesToPdf(images: ImageInput[], options: ImagesToPdfOptions): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const margin = IMAGE_MARGINS[options.margin];
    // Teto de pixels lido do cabecalho ANTES de decodificar: um PNG de
    // poucos KB pode declarar 20000x20000 px e estourar a memoria no embed.
    images.forEach((img, i) => {
      const dims = readImageDimensions(img.buffer, img.kind);
      if (!dims) {
        throw new PdfToolsError('INVALID_INPUT', `A imagem nº ${i + 1} está corrompida ou em formato não suportado.`);
      }
      if (dims.width * dims.height > MAX_IMAGE_PIXELS) {
        throw new PdfToolsError('INVALID_INPUT', `A imagem nº ${i + 1} tem resolução alta demais (máx. ~30 megapixels).`);
      }
    });
    for (let i = 0; i < images.length; i++) {
      let image: PDFImage;
      try {
        image = images[i].kind === 'jpg' ? await doc.embedJpg(images[i].buffer) : await doc.embedPng(images[i].buffer);
      } catch {
        throw new PdfToolsError('INVALID_INPUT', `A imagem nº ${i + 1} está corrompida ou em formato não suportado.`);
      }
      await this.guard(async () => {
        let pageW: number;
        let pageH: number;
        if (options.pageSize === 'ajustar') {
          // Pagina do tamanho da imagem (1 px = 1 pt), limitada ao maximo do PDF.
          const scale = Math.min(1, (MAX_PAGE_POINTS - 2 * margin) / Math.max(image.width, image.height));
          pageW = image.width * scale + 2 * margin;
          pageH = image.height * scale + 2 * margin;
        } else {
          const [w, h] = PAGE_SIZES[options.pageSize];
          const landscape =
            options.orientation === 'paisagem' || (options.orientation === 'auto' && image.width > image.height);
          [pageW, pageH] = landscape ? [h, w] : [w, h];
        }
        const page = doc.addPage([pageW, pageH]);
        const boxW = pageW - 2 * margin;
        const boxH = pageH - 2 * margin;
        const scale = Math.min(boxW / image.width, boxH / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        page.drawImage(image, { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2, width: drawW, height: drawH });
      });
    }
    return this.guard(() => this.save(doc));
  }

  async createTextPdf(options: CreateTextPdfOptions): Promise<{ pdf: Buffer; pages: number }> {
    return this.guard(async () => {
      const doc = await PDFDocument.create();
      const regular = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const [pageW, pageH] = PAGE_SIZES[options.pageSize];
      const marginX = 56;
      const marginTop = 64;
      const marginBottom = 60;
      const contentWidth = pageW - 2 * marginX;
      const base = options.fontSize;
      const title = options.title ? toWinAnsi(options.title, bold) : undefined;
      if (title) doc.setTitle(options.title!);
      doc.setCreator('Gestor de Vendas - Ferramentas PDF');
      doc.setProducer('Gestor de Vendas');

      let page = doc.addPage([pageW, pageH]);
      let y = pageH - marginTop;
      const newPage = () => {
        page = doc.addPage([pageW, pageH]);
        y = pageH - marginTop;
      };
      const ensureSpace = (needed: number) => {
        if (y - needed < marginBottom) newPage();
      };
      const drawLine = (text: string, x: number, font: PDFFont, size: number, color = rgb(0.1, 0.1, 0.12)) => {
        const lineHeight = size * 1.4;
        ensureSpace(lineHeight);
        y -= size;
        page.drawText(text, { x, y, font, size, color });
        y -= lineHeight - size;
      };

      // Titulo grande no inicio do documento.
      if (title) {
        const size = Math.round(base * 1.9);
        for (const line of wrapText(title, bold, size, contentWidth)) drawLine(line, marginX, bold, size);
        y -= base * 0.8;
      }

      const lines = options.content.replace(/\r\n?/g, '\n').split('\n');
      let pendingGap = false;
      for (const rawLine of lines) {
        if (rawLine.trim() === '') {
          pendingGap = true;
          continue;
        }
        if (pendingGap) {
          y -= base * 0.7;
          pendingGap = false;
        }
        if (rawLine.startsWith('# ')) {
          const size = Math.round(base * 1.6);
          y -= base * 0.5;
          ensureSpace(size * 1.4 + base * 1.4); // nao deixa titulo orfao no pe da pagina
          for (const line of wrapText(toWinAnsi(rawLine.slice(2).trim(), bold), bold, size, contentWidth)) {
            drawLine(line, marginX, bold, size);
          }
          y -= base * 0.3;
        } else if (rawLine.startsWith('## ')) {
          const size = Math.round(base * 1.3);
          y -= base * 0.4;
          ensureSpace(size * 1.4 + base * 1.4);
          for (const line of wrapText(toWinAnsi(rawLine.slice(3).trim(), bold), bold, size, contentWidth)) {
            drawLine(line, marginX, bold, size);
          }
          y -= base * 0.2;
        } else if (rawLine.startsWith('- ')) {
          const indent = base * 1.4;
          const wrapped = wrapText(toWinAnsi(rawLine.slice(2).trim(), regular), regular, base, contentWidth - indent);
          wrapped.forEach((line, i) => {
            drawLine(line, marginX + indent, regular, base);
            if (i === 0) {
              // marcador na mesma linha de base do primeiro trecho
              page.drawText('-', { x: marginX + base * 0.4, y: y + base * 0.4, font: regular, size: base });
            }
          });
        } else {
          for (const line of wrapText(toWinAnsi(rawLine, regular), regular, base, contentWidth)) {
            drawLine(line, marginX, regular, base);
          }
        }
      }

      // Cabecalho (titulo, a partir da 2a pagina) e rodape "Pagina n de N".
      const pages = doc.getPages();
      const total = pages.length;
      const small = 9;
      const grey = rgb(0.45, 0.45, 0.5);
      pages.forEach((p, i) => {
        if (title && i > 0) {
          const [headerLine] = wrapText(title, regular, small, contentWidth);
          p.drawText(headerLine, { x: marginX, y: pageH - 36, font: regular, size: small, color: grey });
          p.drawLine({
            start: { x: marginX, y: pageH - 42 },
            end: { x: pageW - marginX, y: pageH - 42 },
            thickness: 0.5,
            color: rgb(0.85, 0.85, 0.88),
          });
        }
        const footer = toWinAnsi(`Página ${i + 1} de ${total}`, regular);
        const fw = regular.widthOfTextAtSize(footer, small);
        p.drawText(footer, { x: (pageW - fw) / 2, y: 30, font: regular, size: small, color: grey });
      });

      return { pdf: await this.save(doc), pages: total };
    });
  }

  // -------------------------------------------------------------------------

  private async load(pdf: Buffer): Promise<PDFDocument> {
    try {
      // Sem ignoreEncryption: PDF protegido lanca EncryptedPDFError.
      const doc = await PDFDocument.load(pdf, { updateMetadata: false });
      // pdf-lib "carrega" arquivos sem catalogo/arvore de paginas validos e
      // so quebra no primeiro acesso (TypeError) - valida aqui, dentro do try.
      if (doc.getPageCount() < 1) throw new Error('PDF sem páginas');
      doc.getPages();
      return doc;
    } catch (error) {
      // pdf-lib e compilado para ES5: `instanceof EncryptedPDFError` nao e
      // confiavel (subclasse de Error) - confere tambem pela mensagem.
      if (
        error instanceof EncryptedPDFError ||
        (error instanceof Error && (error.name === 'EncryptedPDFError' || /is encrypted/i.test(error.message)))
      ) {
        throw new PdfToolsError('ENCRYPTED_PDF', MENSAGEM_PDF_PROTEGIDO);
      }
      throw new PdfToolsError('INVALID_INPUT', 'Não foi possível ler o PDF. Verifique se o arquivo não está corrompido.');
    }
  }

  private async copyInto(src: PDFDocument, indices: number[]): Promise<PDFDocument> {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    return out;
  }

  private async save(doc: PDFDocument): Promise<Buffer> {
    return Buffer.from(await doc.save({ useObjectStreams: true }));
  }

  /** Erros inesperados do pdf-lib viram PROCESSING_FAILED (sem detalhes internos). */
  private async guard<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      if (error instanceof PdfToolsError) throw error;
      throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível processar o PDF.');
    }
  }
}
