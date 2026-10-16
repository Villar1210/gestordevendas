// src/modules/gestao_imobiliaria/infra/http/empreendimento.controller.ts
// Permissoes (16/10/2026): a CLASSE e so Administrador (criar/publicar,
// book analisar/confirmar, lote, planilha, PDF, ficha, fotos, unidades/site).
// So as LEITURAS declaram @Roles(...DASHBOARD_ROLES) explicito.
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateEmpreendimentoDto } from './dtos/create-empreendimento.dto';
import { GerarLoteImoveisDto } from './dtos/gerar-lote-imoveis.dto';
import { CriarImoveisLoteDto } from './dtos/criar-imoveis-lote.dto';
import { ImportarPlanilhaImoveisDto } from './dtos/importar-planilha-imoveis.dto';
import { ConfirmarFichaTecnicaDto } from './dtos/confirmar-ficha-tecnica.dto';
import { ListEmpreendimentosQueryDto } from './dtos/list-empreendimentos-query.dto';
import { UploadEmpreendimentoPhotoDto } from './dtos/upload-empreendimento-photo.dto';
import { ReorderEmpreendimentoPhotosDto } from './dtos/reorder-empreendimento-photos.dto';
import { CreateEmpreendimentoUseCase } from '../../application/use-cases/create-empreendimento.use-case';
import { ListEmpreendimentosUseCase } from '../../application/use-cases/list-empreendimentos.use-case';
import { GerarLoteImoveisUseCase } from '../../application/use-cases/gerar-lote-imoveis.use-case';
import { CriarImoveisLoteUseCase } from '../../application/use-cases/criar-imoveis-lote.use-case';
import { ImportarPlanilhaImoveisUseCase } from '../../application/use-cases/importar-planilha-imoveis.use-case';
import { ListarProdutosPlanilhaUseCase } from '../../application/use-cases/listar-produtos-planilha.use-case';
import { ImportarFichaTecnicaPdfUseCase } from '../../application/use-cases/importar-ficha-tecnica-pdf.use-case';
import { ConfirmarFichaTecnicaUseCase } from '../../application/use-cases/confirmar-ficha-tecnica.use-case';
import { GetEmpreendimentoDetailUseCase } from '../../application/use-cases/get-empreendimento-detail.use-case';
import { PublicarEmpreendimentoUseCase } from '../../application/use-cases/publicar-empreendimento.use-case';
import { DespublicarEmpreendimentoUseCase } from '../../application/use-cases/despublicar-empreendimento.use-case';
import { PublicarUnidadesNoSiteUseCase } from '../../application/use-cases/publicar-unidades-no-site.use-case';
import { PublicarUnidadesSiteDto } from './dtos/publicar-unidades-site.dto';
import { AnalisarBookDto, ConfirmarBookDto } from './dtos/book-empreendimento.dto';
import { AnalisarBookEmpreendimentoUseCase } from '../../application/use-cases/analisar-book-empreendimento.use-case';
import { ConfirmarBookEmpreendimentoUseCase } from '../../application/use-cases/confirmar-book-empreendimento.use-case';
import {
  BaixarZipBookEmpreendimentoUseCase,
  BuscarBookEmpreendimentoUseCase,
} from '../../application/use-cases/book-empreendimento-leitura.use-case';
import { BOOK_MAX_BYTES, BOOK_MAX_IMAGENS } from '../../domain/services/book-empreendimento';
import { BookRequestSizeGuard } from './book-request-size.guard';
import { FOTO_MAX_BYTES } from '../../domain/services/foto-upload';
import { LimiteConcorrenciaGuard } from '../../../../shared/infra/http/limite-concorrencia';

// Maximo de requisicoes pesadas simultaneas POR PROCESSO (alem do throttle
// por IP): analisar (ate 80 MB em memoria + IA) e ZIP do book (~40 MB).
const MAX_ANALISAR_SIMULTANEOS = 2;
const MAX_ZIP_SIMULTANEOS = 2;
import { Throttle } from '@nestjs/throttler';
import { UploadEmpreendimentoPhotoUseCase } from '../../application/use-cases/upload-empreendimento-photo.use-case';
import { DeleteEmpreendimentoPhotoUseCase } from '../../application/use-cases/delete-empreendimento-photo.use-case';
import { ReorderEmpreendimentoPhotosUseCase } from '../../application/use-cases/reorder-empreendimento-photos.use-case';
import { parseDateOnly } from '../../../../shared/utils/date-only.util';

type ArquivoBookUpload = { buffer: Buffer; originalname: string; mimetype: string; size: number };

// Download com nome ASCII + filename* UTF-8 (mesmo formato do pdf_tools).
function contentDisposition(nomeArquivo: string): string {
  const ascii = nomeArquivo.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const codificado = encodeURIComponent(nomeArquivo).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${codificado}`;
}

@Controller('empreendimentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class EmpreendimentoController {
  constructor(
    private readonly createEmpreendimentoUseCase: CreateEmpreendimentoUseCase,
    private readonly listEmpreendimentosUseCase: ListEmpreendimentosUseCase,
    private readonly gerarLoteImoveisUseCase: GerarLoteImoveisUseCase,
    private readonly criarImoveisLoteUseCase: CriarImoveisLoteUseCase,
    private readonly importarPlanilhaImoveisUseCase: ImportarPlanilhaImoveisUseCase,
    private readonly listarProdutosPlanilhaUseCase: ListarProdutosPlanilhaUseCase,
    private readonly importarFichaTecnicaPdfUseCase: ImportarFichaTecnicaPdfUseCase,
    private readonly confirmarFichaTecnicaUseCase: ConfirmarFichaTecnicaUseCase,
    private readonly getEmpreendimentoDetailUseCase: GetEmpreendimentoDetailUseCase,
    private readonly publicarEmpreendimentoUseCase: PublicarEmpreendimentoUseCase,
    private readonly despublicarEmpreendimentoUseCase: DespublicarEmpreendimentoUseCase,
    private readonly publicarUnidadesNoSiteUseCase: PublicarUnidadesNoSiteUseCase,
    private readonly analisarBookUseCase: AnalisarBookEmpreendimentoUseCase,
    private readonly confirmarBookUseCase: ConfirmarBookEmpreendimentoUseCase,
    private readonly buscarBookUseCase: BuscarBookEmpreendimentoUseCase,
    private readonly baixarZipBookUseCase: BaixarZipBookEmpreendimentoUseCase,
    private readonly uploadEmpreendimentoPhotoUseCase: UploadEmpreendimentoPhotoUseCase,
    private readonly deleteEmpreendimentoPhotoUseCase: DeleteEmpreendimentoPhotoUseCase,
    private readonly reorderEmpreendimentoPhotosUseCase: ReorderEmpreendimentoPhotosUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateEmpreendimentoDto, @Req() req: Request) {
    return this.createEmpreendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      name: dto.name,
      rua: dto.rua,
      numero: dto.numero,
      bairro: dto.bairro,
      cidade: dto.cidade,
      uf: dto.uf,
      cep: dto.cep,
      complemento: dto.complemento,
      tipo: dto.tipo,
      construtora: dto.construtora,
      statusObra: dto.statusObra,
      precoMinimo: dto.precoMinimo,
      precoMaximo: dto.precoMaximo,
      description: dto.description,
    });
  }

  // GET /empreendimentos?publicado=true - Fatia 4: o Espelho de Vendas
  // (frontend) sempre passa publicado=true para so listar empreendimentos
  // ja revisados; sem o parametro, devolve todos do tenant (Catalogo,
  // Cadastro em Lote), como sempre foi.
  @Get()
  @Roles(...DASHBOARD_ROLES)
  async list(@Query() query: ListEmpreendimentosQueryDto, @Req() req: Request) {
    return this.listEmpreendimentosUseCase.execute({
      tenantId: req.user!.tenantId,
      publicado: query.publicado !== undefined ? query.publicado === 'true' : undefined,
    });
  }

  // GET /empreendimentos/:id/book - book COMPLETO guardado (Fatia 2 do book):
  // origem, PDF original (se houver) e todas as paginas em ordem, com a
  // categoria de cada uma. 404 se o empreendimento nao tiver book (ou for de
  // outra empresa). Leitura: liberada ao dashboard (Corretor tambem le).
  @Get(':id/book')
  @Roles(...DASHBOARD_ROLES)
  async buscarBook(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.buscarBookUseCase.execute({ tenantId: req.user!.tenantId, empreendimentoId: id });
  }

  // GET /empreendimentos/:id/book/zip?paginas=1,2,5 - ZIP com os JPGs das
  // paginas (<empreendimento>_pagina_01.jpg...). Sem ?paginas = todas exceto
  // "descartar". So inteiros 1..80, sem repetir (senao 400). Os arquivos sao
  // lidos pela url gravada no banco, nunca por caminho vindo do usuario.
  // Throttle proprio: monta ate ~40 MB em memoria por chamada.
  @Get(':id/book/zip')
  @Roles(...DASHBOARD_ROLES)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(LimiteConcorrenciaGuard('book-zip', MAX_ZIP_SIMULTANEOS))
  async baixarZipBook(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('paginas') paginas: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { nomeArquivo, zip } = await this.baixarZipBookUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId: id,
      paginas,
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(zip.length));
    res.setHeader('Content-Disposition', contentDisposition(nomeArquivo));
    // CORS global (main.ts) nao configura exposedHeaders: expoe aqui.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(zip);
  }

  // GET /empreendimentos/:id - Fatia 4 (tela de Revisao e Publicacao):
  // detalhe de um unico empreendimento + tipologias extraidas (Fatia 3c) +
  // contagem real de unidades ja cadastradas (Imovel, distinto do
  // totalUnidades DECLARADO na ficha tecnica do PDF).
  @Get(':id')
  @Roles(...DASHBOARD_ROLES)
  async getOne(@Param('id') id: string, @Req() req: Request) {
    return this.getEmpreendimentoDetailUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId: id,
    });
  }

  // PATCH /empreendimentos/:id/publicar e .../despublicar - Fatia 4: alterna
  // Empreendimento.publicado a partir da tela de Revisao e Publicacao.
  @Patch(':id/publicar')
  async publicar(@Param('id') id: string, @Req() req: Request) {
    return this.publicarEmpreendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId: id,
    });
  }

  @Patch(':id/despublicar')
  async despublicar(@Param('id') id: string, @Req() req: Request) {
    return this.despublicarEmpreendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId: id,
    });
  }

  // POST /empreendimentos/book/analisar - "book" (PDF da construtora ou
  // imagens JPG das paginas): separa as paginas, a IA classifica e le a
  // ficha tecnica. So PREVIEW.
  // Multipart: "file" (1 arquivo, contrato antigo) OU "files" (1 a 80, na
  // ordem das paginas). Os dois juntos -> 400. O tipo real (PDF x JPEG) e
  // validado pelo conteudo no use case.
  // Limite apertado: cada chamada usa a IA (custo) e renderiza o PDF (CPU).
  @Post('book/analisar')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  // Ordem: tamanho declarado -> vaga (no maximo 2 por processo, senao 503)
  // -> multer. Guards rodam ANTES do interceptor do multer, entao o corpo
  // nao e lido quando nao ha vaga.
  @UseGuards(BookRequestSizeGuard, LimiteConcorrenciaGuard('book-analisar', MAX_ANALISAR_SIMULTANEOS))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        // maxCount folgado + limits.files exato: exceder vira "Too many files"
        // em vez de "Unexpected field" (mesmo truque do pdf_tools).
        { name: 'files', maxCount: BOOK_MAX_IMAGENS + 10 },
      ],
      { limits: { fileSize: BOOK_MAX_BYTES, files: BOOK_MAX_IMAGENS, fields: 5, fieldSize: 1024 } },
    ),
  )
  async analisarBook(
    @Body() dto: AnalisarBookDto,
    @UploadedFiles() uploads: { file?: ArquivoBookUpload[]; files?: ArquivoBookUpload[] } | undefined,
    @Req() req: Request,
  ) {
    const unico = uploads?.file ?? [];
    const varios = uploads?.files ?? [];
    if (unico.length && varios.length) {
      throw new BadRequestException('Envie o arquivo no campo "file" OU as páginas no campo "files", não nos dois.');
    }
    return this.analisarBookUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId: dto.empreendimentoId,
      arquivos: unico.length ? unico : varios,
    });
  }

  // POST /empreendimentos/book/confirmar - grava o que foi revisado: cria o
  // empreendimento (ou completa um existente), ficha tecnica e fotos, e
  // guarda o book completo (PDF + todas as paginas; substitui o anterior).
  // Renderiza ate 80 paginas (~1 min): limite de 20/h continua.
  @Post('book/confirmar')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  async confirmarBook(
    @Body() dto: ConfirmarBookDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Cliente fechou a conexao antes de terminar ("close" do RESPONSE - o do
    // request dispara ao fim do upload): o render para entre lotes.
    const cancelar = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) cancelar.abort();
    });
    return this.confirmarBookUseCase.execute({
      sinal: cancelar.signal,
      tenantId: req.user!.tenantId,
      bookId: dto.bookId,
      empreendimentoId: dto.empreendimentoId,
      novo: dto.novo,
      ficha: {
        descricao: dto.ficha.descricao ?? null,
        areaTerreno: dto.ficha.areaTerreno ?? null,
        totalUnidades: dto.ficha.totalUnidades ?? null,
        numeroTorres: dto.ficha.numeroTorres ?? null,
        unidadesPorAndar: dto.ficha.unidadesPorAndar ?? null,
        gabarito: dto.ficha.gabarito ?? null,
        vagas: dto.ficha.vagas ?? null,
        itensLazer: dto.ficha.itensLazer,
        tipologias: dto.ficha.tipologias.map((t) => ({
          nome: t.nome,
          areaPrivativa: t.areaPrivativa ?? null,
          dormitorios: t.dormitorios ?? null,
        })),
      },
      paginas: dto.paginas,
    });
  }

  // PATCH /empreendimentos/:id/unidades/site - liga/desliga "Publicar no
  // site" em todas as unidades de uma vez. So Administrador: expoe (ou
  // retira) centenas de imoveis da internet numa acao so (herda da classe).
  @Patch(':id/unidades/site')
  async publicarUnidadesNoSite(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PublicarUnidadesSiteDto,
    @Req() req: Request,
  ) {
    return this.publicarUnidadesNoSiteUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId: id,
      publicado: dto.publicado,
    });
  }

  // POST /empreendimentos/:empreendimentoId/imoveis/gerar-lote - gera a
  // lista de unidades em memoria (nao persiste nada). O frontend (fatia
  // seguinte) exibe essa lista num grid editavel antes de confirmar.
  @Post(':empreendimentoId/imoveis/gerar-lote')
  async gerarLoteImoveis(
    @Param('empreendimentoId') empreendimentoId: string,
    @Body() dto: GerarLoteImoveisDto,
    @Req() req: Request,
  ) {
    return this.gerarLoteImoveisUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId,
      padrao: {
        bloco: dto.bloco,
        andarInicial: dto.andarInicial,
        andarFinal: dto.andarFinal,
        unidadesPorAndar: dto.unidadesPorAndar,
      },
    });
  }

  // POST /empreendimentos/:empreendimentoId/imoveis/lote - persiste a lista
  // ja revisada/editada pelo usuario, tudo em uma unica transacao.
  @Post(':empreendimentoId/imoveis/lote')
  async criarImoveisLote(
    @Param('empreendimentoId') empreendimentoId: string,
    @Body() dto: CriarImoveisLoteDto,
    @Req() req: Request,
  ) {
    const imoveis = await this.criarImoveisLoteUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId,
      imoveis: dto.imoveis.map((imovel) => ({
        ...imovel,
        disponivelApartirDe: imovel.disponivelApartirDe
          ? parseDateOnly(imovel.disponivelApartirDe)
          : undefined,
      })),
      origemImportacao: dto.origemImportacao,
    });
    return { imoveis };
  }

  // POST /empreendimentos/:empreendimentoId/imoveis/listar-produtos-planilha
  // - Fatia 3b, passo 1 do fluxo no frontend: o usuario ainda nao sabe qual
  // valor de PRODUTO filtrar quando acabou de escolher o arquivo - esse
  // endpoint so le o arquivo e devolve os valores distintos encontrados,
  // sem rodar o parser linha a linha (isso so acontece no passo 2, depois
  // que o usuario escolhe o produto - ver importarPlanilhaImoveis abaixo).
  @Post(':empreendimentoId/imoveis/listar-produtos-planilha')
  @UseInterceptors(FileInterceptor('file'))
  async listarProdutosPlanilha(
    @Param('empreendimentoId') empreendimentoId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Req() req: Request,
  ) {
    return this.listarProdutosPlanilhaUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId,
      file,
    });
  }

  // POST /empreendimentos/:empreendimentoId/imoveis/importar-planilha - le
  // um CSV/XLSX, filtra pela coluna PRODUTO e devolve um preview (nao
  // persiste nada) no MESMO formato do preview do gerar-lote manual + a
  // lista de linhas com erro de parsing. O salvamento reaproveita o
  // POST .../imoveis/lote ja existente (ver criarImoveisLote acima).
  @Post(':empreendimentoId/imoveis/importar-planilha')
  @UseInterceptors(FileInterceptor('file'))
  async importarPlanilhaImoveis(
    @Param('empreendimentoId') empreendimentoId: string,
    @Body() dto: ImportarPlanilhaImoveisDto,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Req() req: Request,
  ) {
    return this.importarPlanilhaImoveisUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId,
      produto: dto.produto,
      file,
    });
  }

  // POST /empreendimentos/:empreendimentoId/importar-pdf - Fatia 3c: le o
  // PDF de apresentacao do produto, extrai a ficha tecnica via IA (Haiku) e
  // devolve um PREVIEW (nao persiste nada) para o usuario revisar/editar
  // antes de confirmar (ver confirmarFichaTecnica abaixo).
  @Post(':empreendimentoId/importar-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async importarFichaTecnicaPdf(
    @Param('empreendimentoId') empreendimentoId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Req() req: Request,
  ) {
    return this.importarFichaTecnicaPdfUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId,
      file,
    });
  }

  // POST /empreendimentos/:empreendimentoId/confirmar-ficha-tecnica -
  // persiste a ficha tecnica ja revisada/editada pelo usuario no preview
  // acima. Marca origemImportacao="ia_pdf" (publicado continua false).
  @Post(':empreendimentoId/confirmar-ficha-tecnica')
  async confirmarFichaTecnica(
    @Param('empreendimentoId') empreendimentoId: string,
    @Body() dto: ConfirmarFichaTecnicaDto,
    @Req() req: Request,
  ) {
    return this.confirmarFichaTecnicaUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId,
      descricao: dto.descricao,
      areaTerreno: dto.areaTerreno,
      totalUnidades: dto.totalUnidades,
      numeroTorres: dto.numeroTorres,
      unidadesPorAndar: dto.unidadesPorAndar,
      gabarito: dto.gabarito,
      vagas: dto.vagas,
      itensLazer: dto.itensLazer,
      tipologias: dto.tipologias.map((tipologia) => ({
        nome: tipologia.nome,
        areaPrivativa: tipologia.areaPrivativa ?? null,
        dormitorios: tipologia.dormitorios ?? null,
      })),
    });
  }

  // POST /empreendimentos/:id/photos - Fatia 5: foto do EMPREENDIMENTO como
  // um todo (planta/area comum), diferente de POST /imoveis/:id/photos
  // (foto de uma unidade especifica). Exige "categoria" no multipart.
  @Post(':id/photos')
  // 1 foto de ate 10 MB; tipo real validado no use case.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: FOTO_MAX_BYTES, files: 1 } }))
  async uploadPhoto(
    @Param('id') id: string,
    @Body() dto: UploadEmpreendimentoPhotoDto,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Req() req: Request,
  ) {
    return this.uploadEmpreendimentoPhotoUseCase.execute({
      empreendimentoId: id,
      tenantId: req.user!.tenantId,
      categoria: dto.categoria,
      file,
    });
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.OK)
  async deletePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ) {
    await this.deleteEmpreendimentoPhotoUseCase.execute({ photoId, tenantId: req.user!.tenantId });
    return { message: 'Foto removida com sucesso.' };
  }

  // PATCH /empreendimentos/:id/photos/reorder - reordena so DENTRO da
  // categoria informada (ver ReorderEmpreendimentoPhotosUseCase).
  @Patch(':id/photos/reorder')
  async reorderPhotos(
    @Param('id') id: string,
    @Body() dto: ReorderEmpreendimentoPhotosDto,
    @Req() req: Request,
  ) {
    return this.reorderEmpreendimentoPhotosUseCase.execute({
      empreendimentoId: id,
      tenantId: req.user!.tenantId,
      categoria: dto.categoria,
      photoIds: dto.photoIds,
    });
  }
}
