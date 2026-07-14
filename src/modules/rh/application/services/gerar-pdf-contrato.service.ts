// src/modules/rh/application/services/gerar-pdf-contrato.service.ts
// Camada de APLICACAO (nao dominio - importa pdf-lib, biblioteca externa,
// ver CLAUDE.md sobre a separacao domain/infra). Desenha o texto ja
// preenchido (ver preencher-contrato-template.ts) num PDF A4 multi-pagina,
// com quebra de linha manual (pdf-lib nao faz isso sozinho) - mesmo
// pacote (pdf-lib) e mesmo padrao ja usado em GenerateSignedPdfUseCase
// (modulo edoc).
import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, PDFFont } from 'pdf-lib';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_FONT_SIZE = 11;
const TITLE_FONT_SIZE = 14;
const LINE_HEIGHT = 16;

interface GerarPdfContratoInput {
  titulo: string;
  corpo: string;
}

export interface GerarPdfContratoResult {
  buffer: Buffer;
  pageCount: number;
}

@Injectable()
export class GerarPdfContratoService {
  async execute(input: GerarPdfContratoInput): Promise<GerarPdfContratoResult> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGIN;

    const addPage = (): void => {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN;
    };

    const drawLine = (text: string, currentFont: PDFFont, size: number): void => {
      if (cursorY - LINE_HEIGHT < MARGIN) {
        addPage();
      }
      page.drawText(text, { x: MARGIN, y: cursorY, size, font: currentFont });
      cursorY -= LINE_HEIGHT;
    };

    // Titulo (centralizado, negrito).
    const titleWidth = boldFont.widthOfTextAtSize(input.titulo, TITLE_FONT_SIZE);
    page.drawText(input.titulo, {
      x: (PAGE_WIDTH - titleWidth) / 2,
      y: cursorY,
      size: TITLE_FONT_SIZE,
      font: boldFont,
    });
    cursorY -= LINE_HEIGHT * 2;

    // Cada paragrafo (separado por linha em branco no corpo) e quebrado em
    // linhas que cabem em MAX_WIDTH - paragrafo vazio vira so um espaco
    // extra entre blocos.
    const paragrafos = input.corpo.split('\n');
    for (const paragrafo of paragrafos) {
      if (!paragrafo.trim()) {
        cursorY -= LINE_HEIGHT * 0.5;
        continue;
      }

      const ehCabecalhoClausula = /^CLÁUSULA/.test(paragrafo);
      const paragrafoFont = ehCabecalhoClausula ? boldFont : font;

      const palavras = paragrafo.split(' ');
      let linhaAtual = '';
      for (const palavra of palavras) {
        const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
        const largura = paragrafoFont.widthOfTextAtSize(tentativa, BODY_FONT_SIZE);
        if (largura > MAX_WIDTH && linhaAtual) {
          drawLine(linhaAtual, paragrafoFont, BODY_FONT_SIZE);
          linhaAtual = palavra;
        } else {
          linhaAtual = tentativa;
        }
      }
      if (linhaAtual) {
        drawLine(linhaAtual, paragrafoFont, BODY_FONT_SIZE);
      }
    }

    const bytes = await pdfDoc.save();
    return { buffer: Buffer.from(bytes), pageCount: pdfDoc.getPageCount() };
  }
}
