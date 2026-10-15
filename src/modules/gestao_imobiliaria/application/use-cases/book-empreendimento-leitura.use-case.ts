// src/modules/gestao_imobiliaria/application/use-cases/book-empreendimento-leitura.use-case.ts
// Leitura do book COMPLETO guardado no empreendimento (Fatia 2 do book):
// - BuscarBookEmpreendimentoUseCase: metadados + paginas (GET .../book).
// - BaixarZipBookEmpreendimentoUseCase: ZIP com os JPGs (GET .../book/zip).
// - ListarPaginasBookPorCategoriaUseCase: paginas por categoria - preparado
//   para a VIVI enviar as paginas pelo WhatsApp (ainda NAO ligado na VIVI).
// Tudo sempre filtrado por tenant: book de outra empresa = 404.
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import {
  EmpreendimentoBookPaginaRecord,
  IEmpreendimentoBookRepository,
} from '../../domain/repositories/empreendimento-book-repository.interface';
import { IZipBookService } from '../../domain/services/zip-book.interface';
import {
  CategoriaPaginaBook,
  OrigemBook,
  ehCategoriaPaginaBook,
  nomeEmpreendimentoParaArquivo,
  nomePaginaNoZip,
  parsePaginasZip,
} from '../../domain/services/book-empreendimento';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';

export interface BookEmpreendimentoOutput {
  origem: OrigemBook;
  pdfUrl: string | null;
  pdfNomeOriginal: string | null;
  totalPaginas: number;
  createdAt: Date;
  paginas: EmpreendimentoBookPaginaRecord[];
}

const MENSAGEM_SEM_BOOK = 'Este empreendimento ainda não tem book salvo.';

// Defesa em profundidade: a url vem do NOSSO banco (gravada no upload), nunca
// do usuario - mesmo assim so le caminhos de /uploads sem "..".
function urlDeArquivoSegura(url: string): boolean {
  return url.startsWith('/uploads/') && !url.includes('..') && !url.includes('\\') && !url.includes('\0');
}

@Injectable()
export class BuscarBookEmpreendimentoUseCase {
  constructor(
    @Inject('IEmpreendimentoBookRepository') private readonly bookRepository: IEmpreendimentoBookRepository,
  ) {}

  async execute(input: { tenantId: string; empreendimentoId: string }): Promise<BookEmpreendimentoOutput> {
    const book = await this.bookRepository.buscarPorEmpreendimento(input.tenantId, input.empreendimentoId);
    if (!book) throw new NotFoundException(MENSAGEM_SEM_BOOK);
    return {
      origem: book.origem,
      pdfUrl: book.pdfUrl,
      pdfNomeOriginal: book.pdfNomeOriginal,
      totalPaginas: book.totalPaginas,
      createdAt: book.createdAt,
      paginas: [...book.paginas]
        .sort((a, b) => a.numero - b.numero)
        .map(({ numero, categoria, url, largura, altura }) => ({ numero, categoria, url, largura, altura })),
    };
  }
}

@Injectable()
export class BaixarZipBookEmpreendimentoUseCase {
  private readonly logger = new Logger(BaixarZipBookEmpreendimentoUseCase.name);

  constructor(
    @Inject('IEmpreendimentoRepository') private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IEmpreendimentoBookRepository') private readonly bookRepository: IEmpreendimentoBookRepository,
    @Inject('IFileStorageService') private readonly fileStorage: IFileStorageService,
    @Inject('IZipBookService') private readonly zip: IZipBookService,
  ) {}

  // paginas: valor cru de ?paginas= (ex: "1,2,5"). Ausente = todas exceto
  // "descartar".
  async execute(input: {
    tenantId: string;
    empreendimentoId: string;
    paginas?: unknown;
  }): Promise<{ nomeArquivo: string; zip: Buffer; quantidade: number }> {
    // Valida o parametro ANTES de tocar no banco/disco.
    const pedido = parsePaginasZip(input.paginas);
    if (!pedido.ok) throw new BadRequestException(pedido.erro);

    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) throw new NotFoundException('Empreendimento não encontrado.');
    const book = await this.bookRepository.buscarPorEmpreendimento(input.tenantId, input.empreendimentoId);
    if (!book) throw new NotFoundException(MENSAGEM_SEM_BOOK);

    let escolhidas: EmpreendimentoBookPaginaRecord[];
    if (pedido.paginas) {
      const porNumero = new Map(book.paginas.map((p) => [p.numero, p]));
      const inexistentes = pedido.paginas.filter((n) => !porNumero.has(n));
      if (inexistentes.length > 0) {
        throw new BadRequestException(`Página(s) inexistente(s) no book: ${inexistentes.join(', ')}.`);
      }
      escolhidas = pedido.paginas.map((n) => porNumero.get(n)!);
    } else {
      escolhidas = book.paginas.filter((p) => p.categoria !== 'descartar');
    }
    escolhidas = [...escolhidas].sort((a, b) => a.numero - b.numero);
    if (escolhidas.length === 0) {
      throw new BadRequestException('Nenhuma página para baixar (todas estão marcadas como "descartar").');
    }

    const arquivos: { nome: string; dados: Buffer }[] = [];
    for (const pagina of escolhidas) {
      if (!urlDeArquivoSegura(pagina.url)) {
        this.logger.error(`Url de página do book fora de /uploads (book ${book.id}, página ${pagina.numero}).`);
        throw new NotFoundException('Arquivo da página não encontrado.');
      }
      let dados: Buffer;
      try {
        dados = await this.fileStorage.download(pagina.url);
      } catch {
        throw new NotFoundException(`Arquivo da página ${pagina.numero} não encontrado.`);
      }
      arquivos.push({ nome: nomePaginaNoZip(empreendimento.name, pagina.numero), dados });
    }
    return {
      nomeArquivo: `${nomeEmpreendimentoParaArquivo(empreendimento.name)}_book.zip`,
      zip: this.zip.montar(arquivos),
      quantidade: arquivos.length,
    };
  }
}

@Injectable()
export class ListarPaginasBookPorCategoriaUseCase {
  constructor(
    @Inject('IEmpreendimentoBookRepository') private readonly bookRepository: IEmpreendimentoBookRepository,
  ) {}

  // Sem categorias = todas exceto "descartar" (o que a VIVI enviaria).
  // Categoria desconhecida e ignorada (nunca devolve "tudo" por engano: se
  // TODAS forem desconhecidas, devolve lista vazia).
  async execute(input: {
    tenantId: string;
    empreendimentoId: string;
    categorias?: string[];
  }): Promise<EmpreendimentoBookPaginaRecord[]> {
    if (input.categorias && input.categorias.length > 0) {
      const validas: CategoriaPaginaBook[] = input.categorias.filter(ehCategoriaPaginaBook);
      if (validas.length === 0) return [];
      return this.bookRepository.listarPaginasPorCategoria(input.tenantId, input.empreendimentoId, validas);
    }
    return this.bookRepository.listarPaginasPorCategoria(input.tenantId, input.empreendimentoId);
  }
}
