// src/modules/gestao_imobiliaria/application/use-cases/analisar-book-empreendimento.use-case.ts
// Passo 1 do "book" do empreendimento: le o PDF pagina a pagina, a IA
// classifica cada pagina (ficha tecnica, fachada, lazer, planta...) e extrai a
// ficha tecnica. NAO grava nada no empreendimento: devolve um PREVIEW para o
// usuario revisar (passo 2 = ConfirmarBookEmpreendimentoUseCase). O PDF fica
// guardado temporariamente para nao precisar ser enviado de novo.
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IPdfReaderService } from '../../domain/services/pdf-reader.interface';
import { IBookTemporarioStorage } from '../../domain/services/book-temporario.interface';
import {
  BOOK_MAX_BYTES,
  BOOK_MAX_PAGINAS,
  BOOK_MAX_PAGINAS_COM_IMAGEM_IA,
  CategoriaPaginaBook,
} from '../../domain/services/book-empreendimento';
import {
  EnderecoExtraidoIA,
  FichaTecnicaExtraidaIA,
  IAiConversationService,
} from '../../../../shared/domain/services/ai-conversation.interface';

export interface AnalisarBookInput {
  tenantId: string;
  empreendimentoId?: string;
  file: { buffer: Buffer; originalname: string; mimetype: string; size?: number };
}

export interface AnalisarBookOutput {
  bookId: string;
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

// Paginas cujo texto alimenta a ficha tecnica, nessa ordem de relevancia.
const ORDEM_TEXTO_FICHA: CategoriaPaginaBook[] = ['ficha_tecnica', 'planta', 'area_comum', 'localizacao', 'fachada'];

@Injectable()
export class AnalisarBookEmpreendimentoUseCase {
  private readonly logger = new Logger(AnalisarBookEmpreendimentoUseCase.name);

  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IPdfReaderService') private readonly pdfReader: IPdfReaderService,
    @Inject('IBookTemporarioStorage') private readonly bookStorage: IBookTemporarioStorage,
    @Inject('IAiConversationService') private readonly ai: IAiConversationService,
  ) {}

  async execute(input: AnalisarBookInput): Promise<AnalisarBookOutput> {
    const { file } = input;
    if (!file?.buffer?.length) throw new BadRequestException('Envie o arquivo PDF do book.');
    // Assinatura de PDF no inicio do arquivo (a extensao/mimetype nao bastam).
    const ehPdf = file.buffer.subarray(0, 1024).toString('latin1').includes('%PDF-');
    if (!ehPdf) throw new BadRequestException('O arquivo precisa ser um PDF.');
    if (file.buffer.length > BOOK_MAX_BYTES) {
      throw new BadRequestException(`O PDF pode ter no máximo ${BOOK_MAX_BYTES / 1024 / 1024} MB.`);
    }

    if (input.empreendimentoId) {
      const existe = await this.empreendimentoRepository.findByIdAndTenant(input.empreendimentoId, input.tenantId);
      if (!existe) throw new NotFoundException('Empreendimento não encontrado.');
    }

    const textos = await this.pdfReader.lerTextoPorPagina(file.buffer);
    if (textos.length === 0) throw new BadRequestException('O PDF não tem páginas.');
    if (textos.length > BOOK_MAX_PAGINAS) {
      throw new BadRequestException(
        `O PDF tem ${textos.length} páginas; o limite é ${BOOK_MAX_PAGINAS}. Envie só as páginas do empreendimento.`,
      );
    }

    const avisos: string[] = [];
    const numeros = textos.map((t) => t.numero);

    // Miniaturas para a IA "ver" as paginas (fotos de lazer quase nao tem texto).
    const comImagem = numeros.slice(0, BOOK_MAX_PAGINAS_COM_IMAGEM_IA);
    const miniaturas = await this.pdfReader.renderizarPaginas(file.buffer, comImagem, {
      larguraPx: 480,
      qualidadeJpeg: 60,
    });
    const miniaturaPorPagina = new Map(miniaturas.map((m) => [m.numero, m.jpeg.toString('base64')]));
    if (numeros.length > comImagem.length) {
      avisos.push(
        `As páginas depois da ${comImagem.length} foram classificadas só pelo texto. Confira a categoria delas.`,
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
          imagemJpegBase64: miniaturaPorPagina.get(t.numero) ?? null,
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
      const i = ORDEM_TEXTO_FICHA.indexOf(categoriaDe.get(n) ?? 'descartar');
      return i === -1 ? ORDEM_TEXTO_FICHA.length : i;
    };
    const textoFicha = [...textos]
      .sort((a, b) => peso(a.numero) - peso(b.numero) || a.numero - b.numero)
      .map((t) => `[Pagina ${t.numero}]\n${t.texto}`)
      .join('\n\n');

    let ficha = FICHA_VAZIA;
    if (textoFicha.replace(/\[Pagina \d+\]/g, '').trim()) {
      try {
        ficha = await this.ai.extrairFichaTecnicaEmpreendimento(textoFicha);
      } catch (err) {
        this.logger.error(`Extração da ficha do book falhou: ${err instanceof Error ? err.message : err}`);
        avisos.push('Não foi possível ler a ficha técnica automaticamente. Preencha os campos abaixo.');
      }
    } else {
      avisos.push('O PDF não tem texto (parece ser só imagem). Preencha a ficha técnica manualmente.');
    }

    const bookId = await this.bookStorage.salvar(input.tenantId, file.buffer);

    return {
      bookId,
      totalPaginas: numeros.length,
      paginas,
      nome: nome ?? ficha.nome,
      construtora,
      endereco,
      ficha,
      avisos,
    };
  }
}
