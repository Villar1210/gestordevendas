// src/modules/gestao_imobiliaria/application/use-cases/confirmar-book-empreendimento.use-case.ts
// Passo 2 do "book": grava o que o usuario revisou. Cria o empreendimento
// (se for novo) ou completa um existente, salva a ficha tecnica e transforma
// as paginas escolhidas em fotos (JPEG), cada uma na sua categoria.
import { BadRequestException, GoneException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';
import { ITipologiaRepository } from '../../domain/repositories/tipologia-repository.interface';
import { IPdfReaderService } from '../../domain/services/pdf-reader.interface';
import { IBookTemporarioStorage } from '../../domain/services/book-temporario.interface';
import { BOOK_MAX_PAGINAS, CATEGORIAS_FOTO_BOOK, ehCategoriaDeFoto } from '../../domain/services/book-empreendimento';
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
}

// Qualidade das fotos gravadas: boa para tela cheia no site, ~200-500 KB.
const LARGURA_FOTO = 1600;
const QUALIDADE_FOTO = 80;

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
    private readonly createEmpreendimento: CreateEmpreendimentoUseCase,
    private readonly confirmarFicha: ConfirmarFichaTecnicaUseCase,
  ) {}

  async execute(input: ConfirmarBookInput): Promise<{ empreendimentoId: string; fotosCriadas: number }> {
    if (!!input.empreendimentoId === !!input.novo) {
      throw new BadRequestException('Informe o empreendimento existente OU os dados do novo empreendimento.');
    }

    // Paginas unicas, validas e que viram foto.
    const vistas = new Set<number>();
    const fotos = input.paginas.filter((p) => {
      if (!ehCategoriaDeFoto(p.categoria) || vistas.has(p.numero)) return false;
      vistas.add(p.numero);
      return Number.isInteger(p.numero) && p.numero >= 1 && p.numero <= BOOK_MAX_PAGINAS;
    });

    const pdf = await this.bookStorage.ler(input.tenantId, input.bookId);
    if (!pdf) {
      throw new GoneException('A análise deste PDF expirou (vale 2 horas). Envie o arquivo novamente.');
    }

    // Renderiza ANTES de criar qualquer coisa: se o PDF der problema, nada
    // fica gravado pela metade.
    const imagens = fotos.length
      ? await this.pdfReader.renderizarPaginas(
          pdf,
          fotos.map((f) => f.numero),
          { larguraPx: LARGURA_FOTO, qualidadeJpeg: QUALIDADE_FOTO },
        )
      : [];
    const imagemPorPagina = new Map(imagens.map((i) => [i.numero, i]));

    let existente: EmpreendimentoRecord | null = null;
    if (input.empreendimentoId) {
      existente = await this.empreendimentoRepository.findByIdAndTenant(input.empreendimentoId, input.tenantId);
      if (!existente) throw new NotFoundException('Empreendimento não encontrado.');
    }

    // Arquivos das fotos PRIMEIRO (a parte mais sujeita a falha). Se algo der
    // errado aqui, nada foi gravado no banco ainda.
    const arquivos: { categoria: string; url: string }[] = [];
    for (const foto of fotos) {
      const imagem = imagemPorPagina.get(foto.numero);
      if (!imagem) continue;
      const { url } = await this.fileStorage.upload({
        buffer: imagem.jpeg,
        originalname: `book-pagina-${foto.numero}.jpg`,
        mimetype: 'image/jpeg',
      });
      arquivos.push({ categoria: foto.categoria, url });
    }

    let empreendimentoId = existente?.id ?? '';
    let criadoAgora = false;
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
      for (const arquivo of arquivos) {
        const order = proximaOrdem.get(arquivo.categoria) ?? 0;
        proximaOrdem.set(arquivo.categoria, order + 1);
        await this.empreendimentoRepository.addPhoto({
          tenantId: input.tenantId,
          empreendimentoId,
          categoria: arquivo.categoria,
          url: arquivo.url,
          order,
        });
      }
    } catch (err) {
      // Empreendimento criado nesta importacao e que ficou pela metade: desfaz
      // (fotos e tipologias saem em cascata), para um novo "Salvar" nao duplicar.
      if (criadoAgora) {
        await this.empreendimentoRepository
          .deleteByIdAndTenant(empreendimentoId, input.tenantId)
          .catch((e) => this.logger.error(`Falha ao desfazer empreendimento ${empreendimentoId}: ${e}`));
      }
      throw err;
    }
    const fotosCriadas = arquivos.length;

    await this.bookStorage.remover(input.tenantId, input.bookId);
    this.logger.log(`Book confirmado: empreendimento ${empreendimentoId}, ${fotosCriadas} fotos.`);
    return { empreendimentoId, fotosCriadas };
  }
}
