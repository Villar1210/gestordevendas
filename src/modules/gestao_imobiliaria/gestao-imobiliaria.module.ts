// src/modules/gestao_imobiliaria/gestao-imobiliaria.module.ts
import { Module } from '@nestjs/common';
import { EmpreendimentoController } from './infra/http/empreendimento.controller';
import { ImovelController } from './infra/http/imovel.controller';
import { ProprietarioController } from './infra/http/proprietario.controller';
import { InquilinoCompradorController } from './infra/http/inquilino-comprador.controller';
import { ContratoController } from './infra/http/contrato.controller';
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
import { CreateContratoUseCase } from './application/use-cases/create-contrato.use-case';
import { ListContratosUseCase } from './application/use-cases/list-contratos.use-case';
import { GetContratoUseCase } from './application/use-cases/get-contrato.use-case';
import { EncerrarContratoUseCase } from './application/use-cases/encerrar-contrato.use-case';
import { PrismaEmpreendimentoRepository } from './infra/database/prisma-empreendimento.repository';
import { PrismaImovelRepository } from './infra/database/prisma-imovel.repository';
import { PrismaProprietarioRepository } from './infra/database/prisma-proprietario.repository';
import { PrismaInquilinoCompradorRepository } from './infra/database/prisma-inquilino-comprador.repository';
import { PrismaContratoRepository } from './infra/database/prisma-contrato.repository';
import { PrismaService } from '../../config/prisma.service';
import { LocalFileStorageService } from '../../shared/infra/services/local-file-storage.service';

@Module({
  controllers: [
    EmpreendimentoController,
    ImovelController,
    ProprietarioController,
    InquilinoCompradorController,
    ContratoController,
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
    CreateContratoUseCase,
    ListContratosUseCase,
    GetContratoUseCase,
    EncerrarContratoUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma / disco local).
    { provide: 'IEmpreendimentoRepository', useClass: PrismaEmpreendimentoRepository },
    { provide: 'IImovelRepository', useClass: PrismaImovelRepository },
    { provide: 'IProprietarioRepository', useClass: PrismaProprietarioRepository },
    { provide: 'IInquilinoCompradorRepository', useClass: PrismaInquilinoCompradorRepository },
    { provide: 'IContratoRepository', useClass: PrismaContratoRepository },
    { provide: 'IFileStorageService', useClass: LocalFileStorageService },
  ],
})
export class GestaoImobiliariaModule {}
