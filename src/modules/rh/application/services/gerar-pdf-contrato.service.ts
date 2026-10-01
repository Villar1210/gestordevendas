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

export interface QuadroAssinatura {
  rotulo: string;
  nome: string;
  detalhe: string | null;
}

interface GerarPdfContratoInput {
  titulo: string;
  corpo: string;
  // Quando informado, acrescenta uma pagina final "Assinaturas eletronicas"
  // com 1 quadro por signatario, e devolve a posicao exata de cada campo
  // (em percentual da pagina, origem no canto superior esquerdo - formato
  // do SignatureField do E-doc).
  assinaturas?: QuadroAssinatura[];
}

export interface CampoAssinaturaPosicao {
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface GerarPdfContratoResult {
  buffer: Buffer;
  pageCount: number;
  campos: CampoAssinaturaPosicao[];
}

// Pagina de assinaturas: 2 colunas, ate 2 linhas (4 signatarios: contratado,
// contratante e 2 testemunhas). Medidas em pontos (A4 = 595 x 842).
const QUADRO_LARGURA = 230;
const QUADRO_COLUNAS_X = [MARGIN, PAGE_WIDTH - MARGIN - QUADRO_LARGURA];
const QUADRO_PRIMEIRA_LINHA_TOPO = 190;
const QUADRO_ALTURA_LINHA = 170;
const CAMPO_ALTURA = 55;

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

    const campos: CampoAssinaturaPosicao[] = [];
    if (input.assinaturas && input.assinaturas.length > 0) {
      const paginaAssinaturas = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const numeroPagina = pdfDoc.getPageCount();
      const titulo = 'ASSINATURAS ELETRÔNICAS';
      paginaAssinaturas.drawText(titulo, {
        x: (PAGE_WIDTH - boldFont.widthOfTextAtSize(titulo, TITLE_FONT_SIZE)) / 2,
        y: PAGE_HEIGHT - MARGIN - 20,
        size: TITLE_FONT_SIZE,
        font: boldFont,
      });
      const aviso = 'As partes abaixo assinam este contrato eletronicamente, na ordem indicada.';
      paginaAssinaturas.drawText(aviso, {
        x: (PAGE_WIDTH - font.widthOfTextAtSize(aviso, 10)) / 2,
        y: PAGE_HEIGHT - MARGIN - 44,
        size: 10,
        font,
      });

      input.assinaturas.slice(0, 4).forEach((quadro, i) => {
        const x = QUADRO_COLUNAS_X[i % 2];
        const topo = QUADRO_PRIMEIRA_LINHA_TOPO + Math.floor(i / 2) * QUADRO_ALTURA_LINHA;
        // pdf-lib usa origem no canto INFERIOR esquerdo.
        const yDe = (distanciaDoTopo: number): number => PAGE_HEIGHT - distanciaDoTopo;

        paginaAssinaturas.drawText(quadro.rotulo, { x, y: yDe(topo), size: 10, font: boldFont });
        const campoTopo = topo + 10;
        const linhaY = yDe(campoTopo + CAMPO_ALTURA);
        paginaAssinaturas.drawLine({
          start: { x, y: linhaY },
          end: { x: x + QUADRO_LARGURA, y: linhaY },
          thickness: 0.8,
        });
        paginaAssinaturas.drawText(cortar(quadro.nome, font, 10, QUADRO_LARGURA), {
          x,
          y: linhaY - 14,
          size: 10,
          font,
        });
        if (quadro.detalhe) {
          paginaAssinaturas.drawText(cortar(quadro.detalhe, font, 9, QUADRO_LARGURA), {
            x,
            y: linhaY - 27,
            size: 9,
            font,
          });
        }

        campos.push({
          pageNumber: numeroPagina,
          xPercent: x / PAGE_WIDTH,
          yPercent: campoTopo / PAGE_HEIGHT,
          widthPercent: QUADRO_LARGURA / PAGE_WIDTH,
          heightPercent: (CAMPO_ALTURA - 4) / PAGE_HEIGHT,
        });
      });
    }

    const bytes = await pdfDoc.save();
    return { buffer: Buffer.from(bytes), pageCount: pdfDoc.getPageCount(), campos };
  }
}

// Corta texto longo com "..." para caber na largura do quadro.
function cortar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string {
  if (fonte.widthOfTextAtSize(texto, tamanho) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && fonte.widthOfTextAtSize(`${t}...`, tamanho) > largura) t = t.slice(0, -1);
  return `${t}...`;
}
