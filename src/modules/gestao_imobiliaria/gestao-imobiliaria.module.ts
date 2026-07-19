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
import { PrismaEmpreendimentoRepository } from './infra/database/prisma-empreendimento.repository';
import { PrismaImovelRepository } from './infra/database/prisma-imovel.repository';
import { PrismaProprietarioRepository } from './infra/database/prisma-proprietario.repository';
import { PrismaInquilinoCompradorRepository } from './infra/database/prisma-inquilino-comprador.repository';
import { PrismaContratoRepository } from './infra/database/prisma-contrato.repository';
import { PrismaLancamentoFinanceiroRepository } from './infra/database/prisma-lancamento-financeiro.repository';
import { PrismaService } from '../../config/prisma.service';
import { LocalFileStorageService } from '../../shared/infra/services/local-file-storage.service';

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
    ListImoveisUseCase,
    GetImovelUseCase,
    UploadImovelPhotoUseCase,
    DeleteImovelPhotoUseCase,
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
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma / disco local).
    { provide: 'IEmpreendimentoRepository', useClass: PrismaEmpreendimentoRepository },
    { provide: 'IImovelRepository', useClass: PrismaImovelRepository },
    { provide: 'IProprietarioRepository', useClass: PrismaProprietarioRepository },
    { provide: 'IInquilinoCompradorRepository', useClass: PrismaInquilinoCompradorRepository },
    { provide: 'IContratoRepository', useClass: PrismaContratoRepository },
    { provide: 'ILancamentoFinanceiroRepository', useClass: PrismaLancamentoFinanceiroRepository },
    { provide: 'IFileStorageService', useClass: LocalFileStorageService },
  ],
  // Exportados para o modulo portal_cliente: GetMeusImoveisUseCase busca
  // o Proprietario pelo e-mail do usuario logado, os Contratos vinculados
  // e os Imoveis desses contratos. BuscarEmpreendimentoPorEnderecoUseCase
  // exportado para o modulo vivi_sdr (tool "buscar_empreendimento_por_endereco").
  exports: [
    'IProprietarioRepository',
    'IContratoRepository',
    'IImovelRepository',
    BuscarEmpreendimentoPorEnderecoUseCase,
  ],
})
export class GestaoImobiliariaModule {}
