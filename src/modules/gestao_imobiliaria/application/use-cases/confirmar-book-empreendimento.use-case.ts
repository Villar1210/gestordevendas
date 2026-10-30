// src/modules/gestao_imobiliaria/application/use-cases/confirmar-book-empreendimento.use-case.ts
// Passo 2 do "book": grava o que o usuario revisou. Cria o empreendimento
// (se for novo) ou completa um existente, salva a ficha tecnica e transforma
// as paginas escolhidas em fotos (JPEG), cada uma na sua categoria.
// Book de PDF: renderiza as paginas. Book de imagens: usa os JPEGs ja
// normalizados na analise (1600 px, q80, sem EXIF) - nao renderiza nada.
// Fatia 2: tambem guarda o book COMPLETO no empreendimento (PDF original,
// se houver, + TODAS as paginas em JPG com a categoria de cada uma, inclusive
// ficha_tecnica e descartar). Um book por empreendimento: o novo substitui o
// anterior. As fotos continuam sendo criadas exatamente como antes (arquivos
// proprios - nao dependem dos arquivos do book, que podem ser substituidos).
import {
  BadRequestException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';
import { ITipologiaRepository } from '../../domain/repositories/tipologia-repository.interface';
import {
  EmpreendimentoBookPaginaRecord,
  IEmpreendimentoBookRepository,
} from '../../domain/repositories/empreendimento-book-repository.interface';
import { IPdfReaderService } from '../../domain/services/pdf-reader.interface';
import { BookTemporario, IBookTemporarioStorage } from '../../domain/services/book-temporario.interface';
import { lerDimensoesJpeg } from '../../domain/services/arquivo-book';
import {
  BOOK_LARGURA_FOTO,
  BOOK_MAX_PAGINAS,
  BOOK_PAGINAS_POR_LOTE_RENDER,
  BOOK_PRAZO_RENDER_MS,
  BOOK_QUALIDADE_FOTO,
  CATEGORIAS_FOTO_BOOK,
  ehCategoriaDeFoto,
  ehCategoriaPaginaBook,
} from '../../domain/services/book-empreendimento';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';
import { CreateEmpreendimentoUseCase } from './create-empreendimento.use-case';
import { ConfirmarFichaTecnicaUseCase } from './confirmar-ficha-tecnica.use-case';

export interface DadosNovoEmpreendimento {
  name: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  construtora?: string;
  // Construtoras (Fatia A): sem construtoraId, o texto acima liga a uma
  // construtora existente pelo nome normalizado ou cria uma nova
  // (CreateEmpreendimentoUseCase).
  construtoraId?: string;
  tipo?: string;
  statusObra?: string;
}

export interface FichaConfirmada {
  descricao?: string | null;
  areaTerreno?: number | null;
  totalUnidades?: number | null;
  numeroTorres?: number | null;
  unidadesPorAndar?: number | null;
  gabarito?: number | null;
  vagas?: number | null;
  itensLazer: string[];
  tipologias: { nome: string; areaPrivativa: number | null; dormitorios: number | null }[];
}

export interface ConfirmarBookInput {
  tenantId: string;
  bookId: string;
  empreendimentoId?: string;
  novo?: DadosNovoEmpreendimento;
  ficha: FichaConfirmada;
  paginas: { numero: number; categoria: string }[];
  // Disparado quando o cliente fecha a conexao (controller): o render e
  // interrompido entre lotes e nada e enviado/gravado.
  sinal?: AbortSignal;
}

export interface ConfirmarBookOutput {
  empreendimentoId: string;
  fotosCriadas: number;
  // Fatia 2 (aditivo): quantas paginas ficaram guardadas no book completo.
  paginasNoBook: number;
}

interface PaginaRenderizada {
  jpeg: Buffer;
  largura: number;
  altura: number;
}

@Injectable()
export class ConfirmarBookEmpreendimentoUseCase {
  private readonly logger = new Logger(ConfirmarBookEmpreendimentoUseCase.name);

  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IPdfReaderService') private readonly pdfReader: IPdfReaderService,
    @Inject('IBookTemporarioStorage') private readonly bookStorage: IBookTemporarioStorage,
    @Inject('IFileStorageService') private readonly fileStorage: IFileStorageService,
    @Inject('ITipologiaRepository') private readonly tipologiaRepository: ITipologiaRepository,
    @Inject('IEmpreendimentoBookRepository') private readonly bookRepository: IEmpreendimentoBookRepository,
    private readonly createEmpreendimento: CreateEmpreendimentoUseCase,
    private readonly confirmarFicha: ConfirmarFichaTecnicaUseCase,
  ) {}

  async execute(input: ConfirmarBookInput): Promise<ConfirmarBookOutput> {
    if (!!input.empreendimentoId === !!input.novo) {
      throw new BadRequestException('Informe o empreendimento existente OU os dados do novo empreendimento.');
    }
    // Trava exclusiva por book (duplo clique em "Salvar"): o 2o pedido recebe
    // 409 enquanto o 1o processa. Sempre solta no fim (sucesso ou erro).
    const soltar = await this.bookStorage.travar(input.tenantId, input.bookId);
    try {
      return await this.confirmar(input);
    } finally {
      await soltar();
    }
  }

  private async confirmar(input: ConfirmarBookInput): Promise<ConfirmarBookOutput> {

    // Categoria de cada pagina informada (a primeira vence se repetir).
    const categoriaPorPagina = new Map<number, string>();
    for (const p of input.paginas) {
      if (!Number.isInteger(p.numero) || p.numero < 1 || p.numero > BOOK_MAX_PAGINAS) continue;
      if (!ehCategoriaPaginaBook(p.categoria) || categoriaPorPagina.has(p.numero)) continue;
      categoriaPorPagina.set(p.numero, p.categoria);
    }
    // Paginas que viram foto (mesma regra de sempre), na ordem informada.
    const vistas = new Set<number>();
    const fotos = input.paginas.filter((p) => {
      if (!ehCategoriaDeFoto(p.categoria) || vistas.has(p.numero)) return false;
      vistas.add(p.numero);
      return Number.isInteger(p.numero) && p.numero >= 1 && p.numero <= BOOK_MAX_PAGINAS;
    });

    const book = await this.bookStorage.ler(input.tenantId, input.bookId);
    if (!book) {
      throw new GoneException('A análise deste book expirou (vale 2 horas). Envie os arquivos novamente.');
    }

    let existente: EmpreendimentoRecord | null = null;
    if (input.empreendimentoId) {
      existente = await this.empreendimentoRepository.findByIdAndTenant(input.empreendimentoId, input.tenantId);
      if (!existente) throw new NotFoundException('Empreendimento não encontrado.');
    }

    // Prepara TODAS as paginas ANTES de criar qualquer coisa: se o arquivo
    // der problema, nada fica gravado pela metade. As fotos reaproveitam
    // essas mesmas imagens (nada e renderizado duas vezes).
    const inicio = Date.now();
    const { totalPaginas, imagens } = await this.prepararPaginas(book, inicio, input.sinal);
    // De novo DEPOIS do render (o ultimo lote pode ter passado do prazo) e
    // antes de qualquer upload.
    this.conferirPrazoECancelamento(inicio, input.sinal);

    // Arquivos PRIMEIRO (a parte mais sujeita a falha), antes do banco. Nomes
    // gerados aqui - nada do nome do arquivo do usuario vai para o caminho.
    const bookId = randomUUID();
    const enviados: string[] = [];
    const enviar = async (buffer: Buffer, originalname: string, mimetype: string): Promise<string> => {
      const { url } = await this.fileStorage.upload({ buffer, originalname, mimetype });
      enviados.push(url);
      return url;
    };

    const arquivos: { categoria: string; url: string }[] = [];
    const paginasBook: EmpreendimentoBookPaginaRecord[] = [];
    let pdfUrl: string | null = null;
    try {
      // Fotos: arquivos proprios (como antes), independentes do book.
      for (const foto of fotos) {
        const imagem = imagens.get(foto.numero);
        if (!imagem) continue;
        const url = await enviar(imagem.jpeg, `book-pagina-${foto.numero}.jpg`, 'image/jpeg');
        arquivos.push({ categoria: foto.categoria, url });
      }
      // Book completo: PDF original + todas as paginas, na ordem.
      if (book.origem === 'pdf') pdfUrl = await enviar(book.pdf, `book-${bookId}.pdf`, 'application/pdf');
      for (const numero of [...imagens.keys()].sort((a, b) => a - b)) {
        const imagem = imagens.get(numero)!;
        const url = await enviar(imagem.jpeg, `book-${bookId}-p${String(numero).padStart(3, '0')}.jpg`, 'image/jpeg');
        paginasBook.push({
          numero,
          categoria: categoriaPorPagina.get(numero) ?? 'descartar',
          url,
          largura: imagem.largura,
          altura: imagem.altura,
        });
      }
    } catch (err) {
      await this.removerArquivos(enviados, 'enviados nesta tentativa');
      throw err;
    }

    let empreendimentoId = existente?.id ?? '';
    let criadoAgora = false;
    let urlsBookAnterior: string[] = [];
    try {
      if (!existente) {
        const criado = await this.createEmpreendimento.execute({ tenantId: input.tenantId, ...input.novo! });
        empreendimentoId = criado.id;
        criadoAgora = true;
      }

      // Em empreendimento EXISTENTE, o book so acrescenta: campo que veio vazio
      // mantem o que ja estava cadastrado (nao apaga dado digitado a mao).
      const tipologiasAtuais = existente
        ? await this.tipologiaRepository.findAllByEmpreendimento(input.tenantId, existente.id)
        : [];
      const f = input.ficha;
      await this.confirmarFicha.execute({
        tenantId: input.tenantId,
        empreendimentoId,
        descricao: f.descricao ?? existente?.description ?? null,
        areaTerreno: f.areaTerreno ?? existente?.areaTerreno ?? null,
        totalUnidades: f.totalUnidades ?? existente?.totalUnidades ?? null,
        numeroTorres: f.numeroTorres ?? existente?.numeroTorres ?? null,
        unidadesPorAndar: f.unidadesPorAndar ?? existente?.unidadesPorAndar ?? null,
        gabarito: f.gabarito ?? existente?.gabarito ?? null,
        vagas: f.vagas ?? existente?.vagas ?? null,
        itensLazer: f.itensLazer.length > 0 ? f.itensLazer : existente?.itensLazer ?? [],
        tipologias:
          f.tipologias.length > 0
            ? f.tipologias
            : tipologiasAtuais.map((t) => ({ nome: t.nome, areaPrivativa: t.areaPrivativa, dormitorios: t.dormitorios })),
      });

      // A ordem dentro de cada categoria continua depois das fotos que ja existem.
      const proximaOrdem = new Map<string, number>();
      for (const categoria of CATEGORIAS_FOTO_BOOK) {
        const atuais = await this.empreendimentoRepository.findPhotosByEmpreendimentoAndCategoria(
          empreendimentoId,
          categoria,
        );
        proximaOrdem.set(categoria, atuais.length);
      }
      const fotosComOrdem = arquivos.map((arquivo) => {
        const order = proximaOrdem.get(arquivo.categoria) ?? 0;
        proximaOrdem.set(arquivo.categoria, order + 1);
        return { categoria: arquivo.categoria, url: arquivo.url, order };
      });

      // UMA transacao: substitui o book anterior (se houver), grava o book
      // novo + paginas e as fotos. Ou tudo, ou nada.
      ({ urlsBookAnterior } = await this.bookRepository.substituirBookEGravarFotos({
        tenantId: input.tenantId,
        empreendimentoId,
        book: {
          id: bookId,
          origem: book.origem,
          pdfUrl,
          pdfNomeOriginal: book.origem === 'pdf' ? book.nomeOriginal ?? null : null,
          totalPaginas,
          paginas: paginasBook,
        },
        fotos: fotosComOrdem,
      }));
    } catch (err) {
      // Empreendimento criado nesta importacao e que ficou pela metade: desfaz
      // (fotos, tipologias e book saem em cascata), para um novo "Salvar" nao
      // duplicar. Os arquivos enviados nesta tentativa tambem saem.
      if (criadoAgora) {
        await this.empreendimentoRepository
          .deleteByIdAndTenant(empreendimentoId, input.tenantId)
          .catch((e: NodeJS.ErrnoException) =>
            this.logger.error(`Falha ao desfazer empreendimento ${empreendimentoId}: ${e?.code ?? e?.name ?? 'erro'}`),
          );
      }
      await this.removerArquivos(enviados, 'enviados nesta tentativa');
      throw err;
    }
    const fotosCriadas = arquivos.length;

    // So DEPOIS do commit: arquivos do book anterior (o banco ja nao aponta
    // mais para eles).
    await this.removerArquivos(urlsBookAnterior, 'do book anterior');
    await this.bookStorage.remover(input.tenantId, input.bookId);
    this.logger.log(
      `Book confirmado: empreendimento ${empreendimentoId}, ${fotosCriadas} fotos, ${paginasBook.length} páginas no book.`,
    );
    return { empreendimentoId, fotosCriadas, paginasNoBook: paginasBook.length };
  }

  // Todas as paginas do book em JPEG (1600 px, q80) + dimensoes.
  // - Imagens: os JPEGs ja normalizados na analise (dimensao lida do cabecalho).
  // - PDF: renderiza em lotes pequenos na fila de render (outros usuarios
  //   intercalam entre um lote e outro), com prazo total: o nginx corta a
  //   requisicao em 300s. Paginas que o leitor pula (proporcao extrema) ficam
  //   de fora do book (aviso no log).
  // Prazo total do render (nginx corta em 300s) e cancelamento pelo cliente.
  private conferirPrazoECancelamento(inicio: number, sinal?: AbortSignal): void {
    if (sinal?.aborted) {
      throw new ServiceUnavailableException('O envio foi cancelado. Nada foi salvo.');
    }
    if (Date.now() - inicio > BOOK_PRAZO_RENDER_MS) {
      this.logger.warn('Render do book passou do prazo.');
      throw new ServiceUnavailableException(
        'O servidor está ocupado e o book demorou demais para processar. Nada foi salvo - tente de novo em alguns minutos.',
      );
    }
  }

  private async prepararPaginas(
    book: BookTemporario,
    inicio: number,
    sinal?: AbortSignal,
  ): Promise<{ totalPaginas: number; imagens: Map<number, PaginaRenderizada> }> {
    const imagens = new Map<number, PaginaRenderizada>();
    if (book.origem === 'imagens') {
      book.imagens.forEach((jpeg, i) => {
        // JPEG ja normalizado sempre tem cabecalho legivel; se nao tiver, a
        // pagina continua (a foto nao some) so sem dimensao conhecida (0).
        const dimensoes = lerDimensoesJpeg(jpeg) ?? { largura: 0, altura: 0 };
        imagens.set(i + 1, { jpeg, largura: dimensoes.largura, altura: dimensoes.altura });
      });
      return { totalPaginas: book.imagens.length, imagens };
    }

    const totalPaginas = Math.min(await this.pdfReader.contarPaginas(book.pdf), BOOK_MAX_PAGINAS);
    const numeros = Array.from({ length: totalPaginas }, (_, i) => i + 1);
    for (let i = 0; i < numeros.length; i += BOOK_PAGINAS_POR_LOTE_RENDER) {
      this.conferirPrazoECancelamento(inicio, sinal);
      const lote = await this.pdfReader.renderizarPaginas(
        book.pdf,
        numeros.slice(i, i + BOOK_PAGINAS_POR_LOTE_RENDER),
        { larguraPx: BOOK_LARGURA_FOTO, qualidadeJpeg: BOOK_QUALIDADE_FOTO },
      );
      for (const pagina of lote) imagens.set(pagina.numero, pagina);
    }
    if (imagens.size < totalPaginas) {
      this.logger.warn(`Book: ${totalPaginas - imagens.size} página(s) não renderizada(s) (proporção extrema).`);
    }
    return { totalPaginas, imagens };
  }

  // Melhor esforco: so remove se o armazenamento souber apagar
  // (LocalFileStorageService so apaga arquivos do book - "book-<uuid>..." -
  // dentro da pasta de uploads; fotos nunca). Falha so gera AVISO no log,
  // nunca erro para o usuario (a operacao no banco ja terminou ou ja falhou).
  private async removerArquivos(urls: string[], motivo: string): Promise<void> {
    if (urls.length === 0) return;
    const apagar = this.fileStorage.delete?.bind(this.fileStorage);
    if (!apagar) {
      this.logger.warn(`${urls.length} arquivo(s) ${motivo} não removido(s): armazenamento sem suporte a apagar.`);
      return;
    }
    for (const url of urls) {
      // So o codigo do erro (ENOENT, EACCES...) - nunca o caminho.
      await apagar(url).catch((e: NodeJS.ErrnoException) =>
        this.logger.warn(`Falha ao remover arquivo ${motivo}: ${e?.code ?? 'erro'}`),
      );
    }
  }
}
