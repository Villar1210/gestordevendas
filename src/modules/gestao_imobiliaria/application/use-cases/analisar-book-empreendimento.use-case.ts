// src/modules/gestao_imobiliaria/application/use-cases/analisar-book-empreendimento.use-case.ts
// Passo 1 do "book" do empreendimento: le o book pagina a pagina, a IA
// classifica cada pagina (ficha tecnica, fachada, lazer, planta...) e extrai a
// ficha tecnica. NAO grava nada no empreendimento: devolve um PREVIEW para o
// usuario revisar (passo 2 = ConfirmarBookEmpreendimentoUseCase). O book fica
// guardado temporariamente para nao precisar ser enviado de novo.
// O book pode ser 1 PDF OU de 1 a 80 imagens JPG/JPEG (uma por pagina, na
// ordem em que chegaram). As imagens sao normalizadas (max 1600 px, JPEG
// q80, sem EXIF) antes de qualquer outra coisa.
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IPdfReaderService, PaginaTextoPdf } from '../../domain/services/pdf-reader.interface';
import { BookTemporario, IBookTemporarioStorage } from '../../domain/services/book-temporario.interface';
import { IImagemBookService } from '../../domain/services/imagem-book.interface';
import { detectarTipoArquivoBook, lerDimensoesJpeg } from '../../domain/services/arquivo-book';
import {
  BOOK_LARGURA_FOTO,
  BOOK_LARGURA_IMAGEM_FICHA,
  BOOK_MAX_BYTES,
  BOOK_MAX_BYTES_POR_IMAGEM,
  BOOK_MAX_IMAGENS,
  BOOK_MAX_PAGINAS,
  BOOK_MAX_PAGINAS_COM_IMAGEM_IA,
  BOOK_MAX_PIXELS_IMAGEM,
  BOOK_MIN_CARACTERES_TEXTO,
  BOOK_QUALIDADE_FOTO,
  BOOK_QUALIDADE_IMAGEM_FICHA,
  CategoriaPaginaBook,
  ORDEM_PAGINAS_FICHA,
  OrigemBook,
  caracteresUteis,
  selecionarPaginasParaFicha,
} from '../../domain/services/book-empreendimento';
import {
  EnderecoExtraidoIA,
  FichaTecnicaExtraidaIA,
  IAiConversationService,
  ImagemPaginaFichaIA,
} from '../../../../shared/domain/services/ai-conversation.interface';

export interface ArquivoBook {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size?: number;
}

export interface AnalisarBookInput {
  tenantId: string;
  empreendimentoId?: string;
  // 1 PDF ou 1 a 80 JPG/JPEG, na ordem das paginas.
  arquivos: ArquivoBook[];
}

export interface AnalisarBookOutput {
  bookId: string;
  origem: OrigemBook;
  totalPaginas: number;
  paginas: { numero: number; categoria: CategoriaPaginaBook; legenda: string | null }[];
  nome: string | null;
  construtora: string | null;
  endereco: EnderecoExtraidoIA;
  ficha: FichaTecnicaExtraidaIA;
  avisos: string[];
}

const FICHA_VAZIA: FichaTecnicaExtraidaIA = {
  nome: null,
  endereco: null,
  descricao: null,
  areaTerreno: null,
  totalUnidades: null,
  numeroTorres: null,
  unidadesPorAndar: null,
  gabarito: null,
  vagas: null,
  tipologias: [],
  itensLazer: [],
};

const ENDERECO_VAZIO: EnderecoExtraidoIA = { rua: null, numero: null, bairro: null, cidade: null, uf: null, cep: null };

const MB = 1024 * 1024;

// Book ja lido e validado, pronto para a IA.
interface BookPreparado {
  guardar: BookTemporario;
  textos: PaginaTextoPdf[];
  miniaturas: Map<number, string>; // numero -> JPEG base64 (480 px)
  // Imagens das paginas para a IA ler a ficha (1000 px), ou null quando o
  // texto do PDF basta.
  imagensFicha: ((numeros: number[]) => Promise<ImagemPaginaFichaIA[]>) | null;
}

@Injectable()
export class AnalisarBookEmpreendimentoUseCase {
  private readonly logger = new Logger(AnalisarBookEmpreendimentoUseCase.name);

  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IPdfReaderService') private readonly pdfReader: IPdfReaderService,
    @Inject('IBookTemporarioStorage') private readonly bookStorage: IBookTemporarioStorage,
    @Inject('IAiConversationService') private readonly ai: IAiConversationService,
    @Inject('IImagemBookService') private readonly imagemBook: IImagemBookService,
  ) {}

  async execute(input: AnalisarBookInput): Promise<AnalisarBookOutput> {
    const origem = this.validarArquivos(input.arquivos ?? []);

    if (input.empreendimentoId) {
      const existe = await this.empreendimentoRepository.findByIdAndTenant(input.empreendimentoId, input.tenantId);
      if (!existe) throw new NotFoundException('Empreendimento não encontrado.');
    }

    const avisos: string[] = [];
    const book =
      origem === 'pdf'
        ? await this.prepararPdf(input.arquivos[0].buffer, avisos)
        : await this.prepararImagens(input.arquivos.map((a) => a.buffer));
    const { textos, miniaturas } = book;
    const numeros = textos.map((t) => t.numero);

    if (numeros.length > BOOK_MAX_PAGINAS_COM_IMAGEM_IA) {
      avisos.push(
        origem === 'pdf'
          ? `As páginas depois da ${BOOK_MAX_PAGINAS_COM_IMAGEM_IA} foram classificadas só pelo texto. Confira a categoria delas.`
          : `As páginas depois da ${BOOK_MAX_PAGINAS_COM_IMAGEM_IA} não foram vistas pela IA. Escolha a categoria delas.`,
      );
    }

    let paginas: AnalisarBookOutput['paginas'] = numeros.map((numero) => ({
      numero,
      categoria: 'descartar',
      legenda: null,
    }));
    let nome: string | null = null;
    let construtora: string | null = null;
    let endereco = ENDERECO_VAZIO;
    try {
      const classificacao = await this.ai.classificarPaginasBook(
        textos.map((t) => ({
          numero: t.numero,
          texto: t.texto,
          imagemJpegBase64: miniaturas.get(t.numero) ?? null,
        })),
      );
      paginas = classificacao.paginas;
      nome = classificacao.nome;
      construtora = classificacao.construtora;
      endereco = classificacao.endereco;
    } catch (err) {
      this.logger.error(`Classificação do book falhou: ${err instanceof Error ? err.message : err}`);
      avisos.push('Não foi possível separar as páginas automaticamente. Escolha a categoria de cada página abaixo.');
    }

    // Texto para a ficha: primeiro as paginas mais relevantes, depois o resto.
    const categoriaDe = new Map(paginas.map((p) => [p.numero, p.categoria]));
    const peso = (n: number) => {
      const i = ORDEM_PAGINAS_FICHA.indexOf(categoriaDe.get(n) ?? 'descartar');
      return i === -1 ? ORDEM_PAGINAS_FICHA.length : i;
    };
    const textoFicha = [...textos]
      .filter((t) => t.texto.trim())
      .sort((a, b) => peso(a.numero) - peso(b.numero) || a.numero - b.numero)
      .map((t) => `[Pagina ${t.numero}]\n${t.texto}`)
      .join('\n\n');

    let ficha = FICHA_VAZIA;
    try {
      if (book.imagensFicha) {
        // Book de imagens ou PDF so de imagem: a IA le a ficha nas imagens.
        const imagens = await book.imagensFicha(selecionarPaginasParaFicha(paginas));
        if (imagens.length > 0) ficha = await this.ai.extrairFichaTecnicaEmpreendimento(textoFicha, imagens);
        else avisos.push('Não foi possível ler a ficha técnica automaticamente. Preencha os campos abaixo.');
      } else {
        ficha = await this.ai.extrairFichaTecnicaEmpreendimento(textoFicha);
      }
    } catch (err) {
      this.logger.error(`Extração da ficha do book falhou: ${err instanceof Error ? err.message : err}`);
      avisos.push('Não foi possível ler a ficha técnica automaticamente. Preencha os campos abaixo.');
    }

    const bookId = await this.bookStorage.salvar(input.tenantId, book.guardar);

    return {
      bookId,
      origem,
      totalPaginas: numeros.length,
      paginas,
      nome: nome ?? ficha.nome,
      construtora,
      endereco,
      ficha,
      avisos,
    };
  }

  // Tipo real pelo CONTEUDO (nunca pela extensao), quantidade e tamanhos.
  // Tudo antes de decodificar qualquer coisa.
  private validarArquivos(arquivos: ArquivoBook[]): OrigemBook {
    if (arquivos.length === 0 || arquivos.some((a) => !a?.buffer?.length)) {
      throw new BadRequestException('Envie o PDF do book ou as imagens (JPG/JPEG) das páginas.');
    }
    const total = arquivos.reduce((soma, a) => soma + a.buffer.length, 0);
    if (total > BOOK_MAX_BYTES) {
      throw new BadRequestException(`O book pode ter no máximo ${BOOK_MAX_BYTES / MB} MB no total.`);
    }

    const tipos = arquivos.map((a) => detectarTipoArquivoBook(a.buffer));
    const invalido = tipos.indexOf('outro');
    if (invalido !== -1) {
      throw new BadRequestException(
        arquivos.length > 1
          ? `O arquivo nº ${invalido + 1} não é PDF nem JPG/JPEG. Envie um PDF ou imagens JPG/JPEG.`
          : 'Envie um PDF ou imagens JPG/JPEG.',
      );
    }
    const pdfs = tipos.filter((t) => t === 'pdf').length;
    if (pdfs > 0 && pdfs < arquivos.length) {
      throw new BadRequestException('Envie 1 PDF ou só imagens JPG/JPEG. Não misture PDF com imagens.');
    }
    if (pdfs > 1) throw new BadRequestException('Envie apenas 1 PDF por vez.');
    if (pdfs === 1) return 'pdf';

    if (arquivos.length > BOOK_MAX_IMAGENS) {
      throw new BadRequestException(`Envie no máximo ${BOOK_MAX_IMAGENS} imagens (uma por página).`);
    }
    arquivos.forEach((a, i) => {
      if (a.buffer.length > BOOK_MAX_BYTES_POR_IMAGEM) {
        throw new BadRequestException(
          `A imagem nº ${i + 1} passa de ${BOOK_MAX_BYTES_POR_IMAGEM / MB} MB. Envie uma imagem menor.`,
        );
      }
      const dimensoes = lerDimensoesJpeg(a.buffer);
      if (!dimensoes) {
        throw new BadRequestException(`Não foi possível ler a imagem nº ${i + 1}. Envie um JPG válido.`);
      }
      if (dimensoes.largura * dimensoes.altura > BOOK_MAX_PIXELS_IMAGEM) {
        throw new BadRequestException(
          `A imagem nº ${i + 1} tem resolução alta demais (máx. ~${BOOK_MAX_PIXELS_IMAGEM / 1_000_000} megapixels).`,
        );
      }
    });
    return 'imagens';
  }

  private async prepararPdf(pdf: Buffer, avisos: string[]): Promise<BookPreparado> {
    const textos = await this.pdfReader.lerTextoPorPagina(pdf);
    if (textos.length === 0) throw new BadRequestException('O PDF não tem páginas.');
    if (textos.length > BOOK_MAX_PAGINAS) {
      throw new BadRequestException(
        `O PDF tem ${textos.length} páginas; o limite é ${BOOK_MAX_PAGINAS}. Envie só as páginas do empreendimento.`,
      );
    }

    // Miniaturas para a IA "ver" as paginas (fotos de lazer quase nao tem texto).
    const comImagem = textos.map((t) => t.numero).slice(0, BOOK_MAX_PAGINAS_COM_IMAGEM_IA);
    const renderizadas = await this.pdfReader.renderizarPaginas(pdf, comImagem, {
      larguraPx: 480,
      qualidadeJpeg: 60,
    });
    const miniaturas = new Map(renderizadas.map((m) => [m.numero, m.jpeg.toString('base64')]));

    // PDF com texto bom: ficha so pelo texto (sem custo extra de imagem).
    // Pouco ou nenhum texto (PDF "so de imagem"): a IA le as paginas.
    let imagensFicha: BookPreparado['imagensFicha'] = null;
    if (caracteresUteis(textos) < BOOK_MIN_CARACTERES_TEXTO) {
      avisos.push(
        'O PDF tem pouco ou nenhum texto: a ficha técnica foi lida pelas imagens das páginas. Confira os campos com atenção.',
      );
      imagensFicha = async (numeros) => {
        const imagens = await this.pdfReader.renderizarPaginas(pdf, numeros, {
          larguraPx: BOOK_LARGURA_IMAGEM_FICHA,
          qualidadeJpeg: BOOK_QUALIDADE_IMAGEM_FICHA,
        });
        return imagens.map((i) => ({ numero: i.numero, imagemJpegBase64: i.jpeg.toString('base64') }));
      };
    }

    return { guardar: { origem: 'pdf', pdf }, textos, miniaturas, imagensFicha };
  }

  private async prepararImagens(jpegs: Buffer[]): Promise<BookPreparado> {
    // Normaliza primeiro: o que fica guardado (e vira foto) e o JPEG limpo.
    const normalizadas = (
      await this.imagemBook.redimensionarJpegs(jpegs, {
        larguraMaxPx: BOOK_LARGURA_FOTO,
        qualidadeJpeg: BOOK_QUALIDADE_FOTO,
      })
    ).map((i) => i.jpeg);

    const comImagem = normalizadas.slice(0, BOOK_MAX_PAGINAS_COM_IMAGEM_IA);
    const reduzidas = await this.imagemBook.redimensionarJpegs(comImagem, { larguraMaxPx: 480, qualidadeJpeg: 60 });
    const miniaturas = new Map(reduzidas.map((m, i) => [i + 1, m.jpeg.toString('base64')]));

    const textos = normalizadas.map((_, i) => ({ numero: i + 1, texto: '' }));
    const imagensFicha = async (numeros: number[]): Promise<ImagemPaginaFichaIA[]> => {
      const validos = numeros.filter((n) => n >= 1 && n <= normalizadas.length);
      const imagens = await this.imagemBook.redimensionarJpegs(
        validos.map((n) => normalizadas[n - 1]),
        { larguraMaxPx: BOOK_LARGURA_IMAGEM_FICHA, qualidadeJpeg: BOOK_QUALIDADE_IMAGEM_FICHA },
      );
      return imagens.map((img, i) => ({ numero: validos[i], imagemJpegBase64: img.jpeg.toString('base64') }));
    };

    return { guardar: { origem: 'imagens', imagens: normalizadas }, textos, miniaturas, imagensFicha };
  }
}
