// src/modules/gestao_imobiliaria/infra/services/pdf-parse-pdf-reader.service.ts
// Camada de INFRA: unico lugar do modulo que sabe que existe pdf-parse
// (mesmo padrao de ExceljsCsvSpreadsheetReaderService/LibreOfficeConverterService).
// @napi-rs/canvas (ja usado internamente pelo pdf-parse) converte a imagem
// da pagina de PNG para JPEG - ~10x menor, importante para o site.
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument, PDFPage } from 'pdf-lib';
import {
  IPdfReaderService,
  PaginaImagemPdf,
  PaginaTextoPdf,
} from '../../domain/services/pdf-reader.interface';
import { naFila } from './fila-render';

// Protecao de memoria: pagina com proporcao absurda (ex: 1 x 20) renderizada
// a 1600px de largura viraria uma imagem de 32.000px de altura (~200 MB).
// A altura maxima e 1,6x a largura pedida (cobre A4 em pe com folga); paginas
// mais altas sao renderizadas mais estreitas, e as extremas sao puladas.
const PROPORCAO_ALTURA_MAX = 1.6;
const PROPORCAO_EXTREMA = 8;
// Folga de arredondamento na conferencia da altura realmente renderizada.
const FOLGA_ALTURA = 1.05;

// Opcoes do pdfjs em TODAS as instancias (revisao de seguranca):
// - maxImageSize: imagem embutida com mais de 25 MP e ignorada (um PDF de
//   1 MB com imagem 20.000x20.000 chegava a ~6 GB de RAM);
// - isEvalSupported: false - nunca compila funcoes/fontes do PDF com eval;
// - canvasMaxAreaInBytes: teto de area dos canvases internos (64 MB).
const OPCOES_PDFJS = {
  maxImageSize: 25_000_000,
  isEvalSupported: false,
  canvasMaxAreaInBytes: 64 * 1024 * 1024,
} as const;

const MENSAGEM_ERRO_LEITURA = 'Não foi possível ler o arquivo PDF.';

// Renderizar PDF usa muita CPU e memoria: no maximo UM render por vez neste
// processo (fila compartilhada com a normalizacao das imagens do book).

@Injectable()
export class PdfParsePdfReaderService implements IPdfReaderService {
  private readonly logger = new Logger(PdfParsePdfReaderService.name);

  // Mensagem FIXA para o usuario; o detalhe do pdfjs/skia so vai para o log.
  private erroLeitura(error: unknown): BadRequestException {
    this.logger.warn(`Falha ao ler PDF: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    return new BadRequestException(MENSAGEM_ERRO_LEITURA);
  }

  private novoParser(pdf: Buffer): PDFParse {
    // pdf-parse/pdfjs podem "consumir" o buffer - sempre passa uma copia.
    return new PDFParse({ data: new Uint8Array(pdf), ...OPCOES_PDFJS });
  }

  async extractText(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    const nomeArquivo = file.originalname.toLowerCase();
    if (!nomeArquivo.endsWith('.pdf') && file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Envie um arquivo .pdf.');
    }

    const parser = this.novoParser(file.buffer);
    try {
      const resultado = await parser.getText();
      return resultado.text;
    } catch (error) {
      throw this.erroLeitura(error);
    } finally {
      await parser.destroy();
    }
  }

  async contarPaginas(pdf: Buffer): Promise<number> {
    try {
      const doc = await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false });
      return doc.getPageCount();
    } catch (error) {
      throw this.erroLeitura(error);
    }
  }

  async lerTextoPorPagina(
    pdf: Buffer,
    opcoes: { maxPaginas: number },
  ): Promise<{ totalPaginas: number; paginas: PaginaTextoPdf[] }> {
    const parser = this.novoParser(pdf);
    try {
      // "first": so as primeiras N paginas sao extraidas; "total" e o numero
      // real de paginas do documento.
      const resultado = await parser.getText({ first: Math.max(1, opcoes.maxPaginas) });
      return {
        totalPaginas: resultado.total,
        paginas: resultado.pages.map((p) => ({ numero: p.num, texto: p.text ?? '' })),
      };
    } catch (error) {
      throw this.erroLeitura(error);
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
    const alturaMaxRender = opcoes.larguraPx * PROPORCAO_ALTURA_MAX * FOLGA_ALTURA;
    const saida: PaginaImagemPdf[] = [];
    const parser = this.novoParser(pdf);
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
          // Segunda trava: se o pdfjs desenhou mais alto que o previsto (caixa
          // da pagina diferente da calculada), descarta ANTES de decodificar.
          if (!(shot.height > 0) || shot.height > alturaMaxRender) {
            this.logger.warn(`Página ${shot.pageNumber} do PDF ignorada: altura renderizada fora do limite.`);
            continue;
          }
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
      throw this.erroLeitura(error);
    } finally {
      await parser.destroy();
    }
  }

  // Area VISIVEL da pagina (o que o pdfjs desenha): CropBox recortado pela
  // MediaBox, ja considerando a rotacao. Usar so a MediaBox deixava passar
  // pagina 1000x1000 com CropBox 10x1000 (renderizada 1600x160.000).
  private tamanhoVisivel(pagina: PDFPage): { largura: number; altura: number } {
    const media = pagina.getMediaBox();
    const crop = pagina.getCropBox();
    const x0 = Math.max(media.x, crop.x);
    const y0 = Math.max(media.y, crop.y);
    const x1 = Math.min(media.x + media.width, crop.x + crop.width);
    const y1 = Math.min(media.y + media.height, crop.y + crop.height);
    let largura = Math.max(0, x1 - x0);
    let altura = Math.max(0, y1 - y0);
    if (pagina.getRotation().angle % 180 !== 0) [largura, altura] = [altura, largura];
    return { largura, altura };
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
      throw this.erroLeitura(error);
    }
    const alturaMax = larguraPx * PROPORCAO_ALTURA_MAX;
    const mapa = new Map<number, number>();
    try {
      for (const numero of paginas) {
        if (numero < 1 || numero > doc.getPageCount()) continue;
        const { largura, altura } = this.tamanhoVisivel(doc.getPage(numero - 1));
        if (!(largura > 0 && altura > 0)) continue;
        const proporcao = altura / largura;
        if (proporcao > PROPORCAO_EXTREMA || proporcao < 1 / PROPORCAO_EXTREMA) continue;
        mapa.set(numero, Math.max(1, Math.floor(Math.min(larguraPx, alturaMax / proporcao))));
      }
    } catch (error) {
      // PDF com arvore de paginas quebrada: pdf-lib lanca erro cru.
      throw this.erroLeitura(error);
    }
    return mapa;
  }
}
