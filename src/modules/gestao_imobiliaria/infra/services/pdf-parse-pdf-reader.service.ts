// src/modules/gestao_imobiliaria/infra/services/pdf-parse-pdf-reader.service.ts
// Camada de INFRA: unico lugar do modulo que sabe que existe pdf-parse
// (mesmo padrao de ExceljsCsvSpreadsheetReaderService/LibreOfficeConverterService).
// @napi-rs/canvas (ja usado internamente pelo pdf-parse) converte a imagem
// da pagina de PNG para JPEG - ~10x menor, importante para o site.
import { Injectable, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import {
  IPdfReaderService,
  PaginaImagemPdf,
  PaginaTextoPdf,
} from '../../domain/services/pdf-reader.interface';

// Protecao de memoria: pagina com proporcao absurda (ex: 1 x 20) renderizada
// a 1600px de largura viraria uma imagem de 32.000px de altura (~200 MB).
// A altura maxima e 1,6x a largura pedida (cobre A4 em pe com folga); paginas
// mais altas sao renderizadas mais estreitas, e as extremas sao puladas.
const PROPORCAO_ALTURA_MAX = 1.6;
const PROPORCAO_EXTREMA = 8;

// Renderizar PDF usa muita CPU e memoria e roda na thread principal do Node:
// no maximo UM render por vez neste processo (os demais esperam na fila), para
// um book grande nao travar o sistema para todo mundo.
let filaRender: Promise<unknown> = Promise.resolve();
function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = filaRender.then(tarefa, tarefa);
  filaRender = resultado.catch(() => undefined);
  return resultado;
}

function erroLeitura(error: unknown): BadRequestException {
  return new BadRequestException(
    `Não foi possível ler o arquivo PDF: ${error instanceof Error ? error.message : 'erro desconhecido'}.`,
  );
}

@Injectable()
export class PdfParsePdfReaderService implements IPdfReaderService {
  async extractText(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    const nomeArquivo = file.originalname.toLowerCase();
    if (!nomeArquivo.endsWith('.pdf') && file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Envie um arquivo .pdf.');
    }

    const parser = new PDFParse({ data: file.buffer });
    try {
      const resultado = await parser.getText();
      return resultado.text;
    } catch (error) {
      throw erroLeitura(error);
    } finally {
      await parser.destroy();
    }
  }

  async lerTextoPorPagina(pdf: Buffer): Promise<PaginaTextoPdf[]> {
    // pdf-parse/pdfjs podem "consumir" o buffer - sempre passa uma copia.
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    try {
      const resultado = await parser.getText();
      return resultado.pages.map((p) => ({ numero: p.num, texto: p.text ?? '' }));
    } catch (error) {
      throw erroLeitura(error);
    } finally {
      await parser.destroy();
    }
  }

  renderizarPaginas(
    pdf: Buffer,
    paginas: number[],
    opcoes: { larguraPx: number; qualidadeJpeg: number },
  ): Promise<PaginaImagemPdf[]> {
    return naFila(() => this.renderizar(pdf, paginas, opcoes));
  }

  private async renderizar(
    pdf: Buffer,
    paginas: number[],
    opcoes: { larguraPx: number; qualidadeJpeg: number },
  ): Promise<PaginaImagemPdf[]> {
    const larguras = await this.larguraSeguraPorPagina(pdf, paginas, opcoes.larguraPx);
    const saida: PaginaImagemPdf[] = [];
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    try {
      // Uma pagina por vez: cada uma tem a sua largura segura e o pico de
      // memoria fica limitado a uma imagem.
      for (const numero of paginas) {
        const largura = larguras.get(numero);
        if (!largura) continue; // pagina inexistente ou com proporcao extrema
        const shots = await parser.getScreenshot({
          partial: [numero],
          desiredWidth: largura,
          imageBuffer: true,
          imageDataUrl: false,
        });
        for (const shot of shots.pages) {
          const imagem = await loadImage(Buffer.from(shot.data));
          const canvas = createCanvas(imagem.width, imagem.height);
          const ctx = canvas.getContext('2d');
          // JPEG nao tem transparencia: fundo branco (senao vira preto).
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, imagem.width, imagem.height);
          ctx.drawImage(imagem, 0, 0);
          saida.push({
            numero: shot.pageNumber,
            jpeg: await canvas.encode('jpeg', opcoes.qualidadeJpeg),
            largura: imagem.width,
            altura: imagem.height,
          });
        }
      }
      return saida;
    } catch (error) {
      throw erroLeitura(error);
    } finally {
      await parser.destroy();
    }
  }

  // Largura de render de cada pagina, respeitando a altura maxima. Paginas
  // com proporcao extrema ficam de fora do mapa (nao sao renderizadas).
  private async larguraSeguraPorPagina(
    pdf: Buffer,
    paginas: number[],
    larguraPx: number,
  ): Promise<Map<number, number>> {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false });
    } catch (error) {
      throw erroLeitura(error);
    }
    const alturaMax = larguraPx * PROPORCAO_ALTURA_MAX;
    const mapa = new Map<number, number>();
    for (const numero of paginas) {
      if (numero < 1 || numero > doc.getPageCount()) continue;
      const pagina = doc.getPage(numero - 1);
      let { width, height } = pagina.getSize();
      if (pagina.getRotation().angle % 180 !== 0) [width, height] = [height, width];
      if (!(width > 0 && height > 0)) continue;
      const proporcao = height / width;
      if (proporcao > PROPORCAO_EXTREMA || proporcao < 1 / PROPORCAO_EXTREMA) continue;
      mapa.set(numero, Math.max(1, Math.floor(Math.min(larguraPx, alturaMax / proporcao))));
    }
    return mapa;
  }
}
