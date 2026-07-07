// src/modules/gestao_imobiliaria/gestao-imobiliaria.module.ts
import { Module } from '@nestjs/common';
import { EmpreendimentoController } from './infra/http/empreendimento.controller';
import { ImovelController } from './infra/http/imovel.controller';
import { CreateEmpreendimentoUseCase } from './application/use-cases/create-empreendimento.use-case';
import { ListEmpreendimentosUseCase } from './application/use-cases/list-empreendimentos.use-case';
import { CreateImovelUseCase } from './application/use-cases/create-imovel.use-case';
import { UpdateImovelUseCase } from './application/use-cases/update-imovel.use-case';
import { ListImoveisUseCase } from './application/use-cases/list-imoveis.use-case';
import { GetImovelUseCase } from './application/use-cases/get-imovel.use-case';
import { UploadImovelPhotoUseCase } from './application/use-cases/upload-imovel-photo.use-case';
import { DeleteImovelPhotoUseCase } from './application/use-cases/delete-imovel-photo.use-case';
import { PrismaEmpreendimentoRepository } from './infra/database/prisma-empreendimento.repository';
import { PrismaImovelRepository } from './infra/database/prisma-imovel.repository';
import { PrismaService } from '../../config/prisma.service';
import { LocalFileStorageService } from '../../shared/infra/services/local-file-storage.service';

@Module({
  controllers: [EmpreendimentoController, ImovelController],
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
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma / disco local).
    { provide: 'IEmpreendimentoRepository', useClass: PrismaEmpreendimentoRepository },
    { provide: 'IImovelRepository', useClass: PrismaImovelRepository },
    { provide: 'IFileStorageService', useClass: LocalFileStorageService },
  ],
})
export class GestaoImobiliariaModule {}
