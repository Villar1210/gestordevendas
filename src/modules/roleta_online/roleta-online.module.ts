// src/modules/roleta_online/roleta-online.module.ts
import { Module } from '@nestjs/common';
import { VendasKanbanModule } from '../vendas_kanban/vendas-kanban.module';
import { RhModule } from '../rh/rh.module';
import { RoletaController } from './infra/http/roleta.controller';
import { GetRoletaConfigUseCase } from './application/use-cases/get-roleta-config.use-case';
import { UpdateRoletaConfigUseCase } from './application/use-cases/update-roleta-config.use-case';
import { DistributeLeadUseCase } from './application/use-cases/distribute-lead.use-case';
import { ConfirmSuggestedOwnerUseCase } from './application/use-cases/confirm-suggested-owner.use-case';
import { CardSemDonoCriadoListener } from './infra/listeners/card-sem-dono-criado.listener';
import { PrismaRoletaConfigRepository } from './infra/database/prisma-roleta-config.repository';
import { PrismaService } from '../../config/prisma.service';

@Module({
  // Dependencia de modulo (nao circular): roleta_online consome use cases e
  // repositorios ja exportados por vendas_kanban e rh (ClaimCardUseCase,
  // ICardRepository, IStageRepository, ICorretorRepository, IRoleRepository).
  // O caminho inverso nao existe - vendas_kanban so emite um evento
  // generico ('card.sem_dono.criado'), sem conhecer quem escuta (mesmo
  // padrao do modulo vivi_sdr com o whatsappmarketing).
  imports: [VendasKanbanModule, RhModule],
  controllers: [RoletaController],
  providers: [
    PrismaService,
    GetRoletaConfigUseCase,
    UpdateRoletaConfigUseCase,
    DistributeLeadUseCase,
    ConfirmSuggestedOwnerUseCase,
    CardSemDonoCriadoListener,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma).
    { provide: 'IRoletaConfigRepository', useClass: PrismaRoletaConfigRepository },
  ],
})
export class RoletaOnlineModule {}
