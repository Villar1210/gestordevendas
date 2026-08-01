// src/modules/gestao_imobiliaria/gestao-imobiliaria.module.ts
import { Module } from '@nestjs/common';
import { EmpreendimentoController } from './infra/http/empreendimento.controller';
import { ImovelController } from './infra/http/imovel.controller';
import { ProprietarioController } from './infra/http/proprietario.controller';
import { InquilinoCompradorController } from './infra/http/inquilino-comprador.controller';
import { ContratoController } from './infra/http/contrato.controller';
import { FinanceiroController } from './infra/http/financeiro.controller';
import { CreateEmpreendimentoUseCase } from './application/use-cases/create-empreendimento.use-case';
import { ListEmpreendimentosUseCase } from './application/use-cases/list-empreendimentos.use-case';
import { CreateImovelUseCase } from './application/use-cases/create-imovel.use-case';
import { UpdateImovelUseCase } from './application/use-cases/update-imovel.use-case';
import { GerarLoteImoveisUseCase } from './application/use-cases/gerar-lote-imoveis.use-case';
import { CriarImoveisLoteUseCase } from './application/use-cases/criar-imoveis-lote.use-case';
import { ImportarPlanilhaImoveisUseCase } from './application/use-cases/importar-planilha-imoveis.use-case';
import { ListarProdutosPlanilhaUseCase } from './application/use-cases/listar-produtos-planilha.use-case';
import { ListImoveisUseCase } from './application/use-cases/list-imoveis.use-case';
import { GetImovelUseCase } from './application/use-cases/get-imovel.use-case';
import { UploadImovelPhotoUseCase } from './application/use-cases/upload-imovel-photo.use-case';
import { DeleteImovelPhotoUseCase } from './application/use-cases/delete-imovel-photo.use-case';
import { CreateProprietarioUseCase } from './application/use-cases/create-proprietario.use-case';
import { ListProprietariosUseCase } from './application/use-cases/list-proprietarios.use-case';
import { UpdateProprietarioUseCase } from './application/use-cases/update-proprietario.use-case';
import { CreateInquilinoCompradorUseCase } from './application/use-cases/create-inquilino-comprador.use-case';
import { ListInquilinosCompradoresUseCase } from './application/use-cases/list-inquilinos-compradores.use-case';
import { UpdateInquilinoCompradorUseCase } from './application/use-cases/update-inquilino-comprador.use-case';
import { UploadInquilinoDocumentoUseCase } from './application/use-cases/upload-inquilino-documento.use-case';
import { ListInquilinoDocumentosUseCase } from './application/use-cases/list-inquilino-documentos.use-case';
import { DeleteInquilinoDocumentoUseCase } from './application/use-cases/delete-inquilino-documento.use-case';
import { CreateContratoUseCase } from './application/use-cases/create-contrato.use-case';
import { ListContratosUseCase } from './application/use-cases/list-contratos.use-case';
import { GetContratoUseCase } from './application/use-cases/get-contrato.use-case';
import { EncerrarContratoUseCase } from './application/use-cases/encerrar-contrato.use-case';
import { CreateLancamentoUseCase } from './application/use-cases/create-lancamento.use-case';
import { ListLancamentosUseCase } from './application/use-cases/list-lancamentos.use-case';
import { MarcarComoPagoUseCase } from './application/use-cases/marcar-como-pago.use-case';
import { GerarCobrancasDoMesUseCase } from './application/use-cases/gerar-cobrancas-do-mes.use-case';
import { AtualizarStatusVencidosUseCase } from './application/use-cases/atualizar-status-vencidos.use-case';
import { BuscarEmpreendimentoPorEnderecoUseCase } from './application/use-cases/buscar-empreendimento-por-endereco.use-case';
import { ImportarFichaTecnicaPdfUseCase } from './application/use-cases/importar-ficha-tecnica-pdf.use-case';
import { ConfirmarFichaTecnicaUseCase } from './application/use-cases/confirmar-ficha-tecnica.use-case';
import { GetEmpreendimentoDetailUseCase } from './application/use-cases/get-empreendimento-detail.use-case';
import { PublicarEmpreendimentoUseCase } from './application/use-cases/publicar-empreendimento.use-case';
import { DespublicarEmpreendimentoUseCase } from './application/use-cases/despublicar-empreendimento.use-case';
import { UploadEmpreendimentoPhotoUseCase } from './application/use-cases/upload-empreendimento-photo.use-case';
import { DeleteEmpreendimentoPhotoUseCase } from './application/use-cases/delete-empreendimento-photo.use-case';
import { ReorderEmpreendimentoPhotosUseCase } from './application/use-cases/reorder-empreendimento-photos.use-case';
import { ReorderImovelPhotosUseCase } from './application/use-cases/reorder-imovel-photos.use-case';
import { PrismaEmpreendimentoRepository } from './infra/database/prisma-empreendimento.repository';
import { PrismaImovelRepository } from './infra/database/prisma-imovel.repository';
import { PrismaProprietarioRepository } from './infra/database/prisma-proprietario.repository';
import { PrismaInquilinoCompradorRepository } from './infra/database/prisma-inquilino-comprador.repository';
import { PrismaContratoRepository } from './infra/database/prisma-contrato.repository';
import { PrismaLancamentoFinanceiroRepository } from './infra/database/prisma-lancamento-financeiro.repository';
import { PrismaTipologiaRepository } from './infra/database/prisma-tipologia.repository';
import { PrismaService } from '../../config/prisma.service';
import { LocalFileStorageService } from '../../shared/infra/services/local-file-storage.service';
import { ExceljsCsvSpreadsheetReaderService } from './infra/services/exceljs-csv-spreadsheet-reader.service';
import { PdfParsePdfReaderService } from './infra/services/pdf-parse-pdf-reader.service';
import { AnthropicConversationService } from '../../shared/infra/services/anthropic-conversation.service';

@Module({
  controllers: [
    EmpreendimentoController,
    ImovelController,
    ProprietarioController,
    InquilinoCompradorController,
    ContratoController,
    FinanceiroController,
  ],
  providers: [
    PrismaService,
    CreateEmpreendimentoUseCase,
    ListEmpreendimentosUseCase,
    CreateImovelUseCase,
    UpdateImovelUseCase,
    GerarLoteImoveisUseCase,
    CriarImoveisLoteUseCase,
    ImportarPlanilhaImoveisUseCase,
    ListarProdutosPlanilhaUseCase,
    ListImoveisUseCase,
    GetImovelUseCase,
    UploadImovelPhotoUseCase,
    DeleteImovelPhotoUseCase,
    ReorderImovelPhotosUseCase,
    CreateProprietarioUseCase,
    ListProprietariosUseCase,
    UpdateProprietarioUseCase,
    CreateInquilinoCompradorUseCase,
    ListInquilinosCompradoresUseCase,
    UpdateInquilinoCompradorUseCase,
    UploadInquilinoDocumentoUseCase,
    ListInquilinoDocumentosUseCase,
    DeleteInquilinoDocumentoUseCase,
    CreateContratoUseCase,
    ListContratosUseCase,
    GetContratoUseCase,
    EncerrarContratoUseCase,
    CreateLancamentoUseCase,
    ListLancamentosUseCase,
    MarcarComoPagoUseCase,
    GerarCobrancasDoMesUseCase,
    AtualizarStatusVencidosUseCase,
    BuscarEmpreendimentoPorEnderecoUseCase,
    ImportarFichaTecnicaPdfUseCase,
    ConfirmarFichaTecnicaUseCase,
    GetEmpreendimentoDetailUseCase,
    PublicarEmpreendimentoUseCase,
    DespublicarEmpreendimentoUseCase,
    UploadEmpreendimentoPhotoUseCase,
    DeleteEmpreendimentoPhotoUseCase,
    ReorderEmpreendimentoPhotosUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma / disco local).
    { provide: 'IEmpreendimentoRepository', useClass: PrismaEmpreendimentoRepository },
    { provide: 'IImovelRepository', useClass: PrismaImovelRepository },
    { provide: 'IProprietarioRepository', useClass: PrismaProprietarioRepository },
    { provide: 'IInquilinoCompradorRepository', useClass: PrismaInquilinoCompradorRepository },
    { provide: 'IContratoRepository', useClass: PrismaContratoRepository },
    { provide: 'ILancamentoFinanceiroRepository', useClass: PrismaLancamentoFinanceiroRepository },
    { provide: 'ITipologiaRepository', useClass: PrismaTipologiaRepository },
    { provide: 'IFileStorageService', useClass: LocalFileStorageService },
    { provide: 'ISpreadsheetReaderService', useClass: ExceljsCsvSpreadsheetReaderService },
    { provide: 'IPdfReaderService', useClass: PdfParsePdfReaderService },
    // Mesmo padrao ja usado para PrismaService: cada modulo consumidor
    // re-registra a mesma classe concreta como provider proprio, em vez de
    // importar o modulo vivi_sdr (que hoje e o unico a registrar isso) -
    // evita dependencia cruzada entre modulos de negocio.
    { provide: 'IAiConversationService', useClass: AnthropicConversationService },
  ],
  // Exportados para o modulo portal_cliente: GetMeusImoveisUseCase busca
  // o Proprietario pelo e-mail do usuario logado, os Contratos vinculados
  // e os Imoveis desses contratos. BuscarEmpreendimentoPorEnderecoUseCase
  // exportado para o modulo vivi_sdr (tool "buscar_empreendimento_por_endereco").
  exports: [
    'IProprietarioRepository',
    'IContratoRepository',
    'IImovelRepository',
    // Integracao VIVI (2026) - exportado para AgendarVisitaUseCase (vivi_sdr)
    // buscar o plantao (endereco/horario) do Empreendimento da conversa, na
    // mensagem de confirmacao de visita.
    'IEmpreendimentoRepository',
    BuscarEmpreendimentoPorEnderecoUseCase,
  ],
})
export class GestaoImobiliariaModule {}
