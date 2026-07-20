// src/modules/vendas_kanban/vendas-kanban.module.ts
import { Module } from '@nestjs/common';
import { PipelineController } from './infra/http/pipeline.controller';
import { CardController } from './infra/http/card.controller';
import { CreatePipelineUseCase } from './application/use-cases/create-pipeline.use-case';
import { CreateDefaultPipelineUseCase } from './application/use-cases/create-default-pipeline.use-case';
import { ListPipelinesUseCase } from './application/use-cases/list-pipelines.use-case';
import { GetBoardUseCase } from './application/use-cases/get-board.use-case';
import { CreateStageUseCase } from './application/use-cases/create-stage.use-case';
import { MoveStageUseCase } from './application/use-cases/move-stage.use-case';
import { RenameStageUseCase } from './application/use-cases/rename-stage.use-case';
import { DeleteStageUseCase } from './application/use-cases/delete-stage.use-case';
import { CreateCardUseCase } from './application/use-cases/create-card.use-case';
import { UpdateCardUseCase } from './application/use-cases/update-card.use-case';
import { MoveCardUseCase } from './application/use-cases/move-card.use-case';
import { DeleteCardUseCase } from './application/use-cases/delete-card.use-case';
import { CreateActivityUseCase } from './application/use-cases/create-activity.use-case';
import { ListActivitiesByCardUseCase } from './application/use-cases/list-activities-by-card.use-case';
import { ToggleActivityDoneUseCase } from './application/use-cases/toggle-activity-done.use-case';
import { CreateNoteUseCase } from './application/use-cases/create-note.use-case';
import { ListNotesByCardUseCase } from './application/use-cases/list-notes-by-card.use-case';
import { CreateQuickCardUseCase } from './application/use-cases/create-quick-card.use-case';
import { GetInboxUseCase } from './application/use-cases/get-inbox.use-case';
import { ClaimCardUseCase } from './application/use-cases/claim-card.use-case';
import { GetMeuDashboardUseCase } from './application/use-cases/get-meu-dashboard.use-case';
import { MoverLeadsInativosParaRepiqueUseCase } from './application/use-cases/mover-leads-inativos-para-repique.use-case';
import { PrismaPipelineRepository } from './infra/database/prisma-pipeline.repository';
import { PrismaStageRepository } from './infra/database/prisma-stage.repository';
import { PrismaCardRepository } from './infra/database/prisma-card.repository';
import { PrismaActivityRepository } from './infra/database/prisma-activity.repository';
import { PrismaNoteRepository } from './infra/database/prisma-note.repository';
import { RepiqueInatividadeScheduler } from './infra/scheduler/repique-inatividade.scheduler';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { PlantaoModule } from '../plantao/plantao.module';
import { WhatsAppMarketingModule } from '../whatsappmarketing/whatsapp-marketing.module';

@Module({
  // AuthModule: GetSubordinadosRecursivosUseCase, usado por GetBoardUseCase
  // para resolver o escopo "equipe" do RBAC por cargo hierarquico.
  // PlantaoModule: GetCorretoresEscaladosHojeUseCase, usado por
  // GetBoardUseCase para resolver o escopo "plantao" (Coordenador).
  // WhatsAppMarketingModule: IWhatsAppMessageRepository, usado pelo job de
  // inatividade do Repique (MoverLeadsInativosParaRepiqueUseCase) para
  // verificar mensagens recentes antes de mover um card por inatividade.
  imports: [AuthModule, PlantaoModule, WhatsAppMarketingModule],
  controllers: [PipelineController, CardController],
  providers: [
    PrismaService,
    CreatePipelineUseCase,
    CreateDefaultPipelineUseCase,
    ListPipelinesUseCase,
    GetBoardUseCase,
    CreateStageUseCase,
    MoveStageUseCase,
    RenameStageUseCase,
    DeleteStageUseCase,
    CreateCardUseCase,
    UpdateCardUseCase,
    MoveCardUseCase,
    DeleteCardUseCase,
    CreateActivityUseCase,
    ListActivitiesByCardUseCase,
    ToggleActivityDoneUseCase,
    CreateNoteUseCase,
    ListNotesByCardUseCase,
    CreateQuickCardUseCase,
    GetInboxUseCase,
    ClaimCardUseCase,
    GetMeuDashboardUseCase,
    MoverLeadsInativosParaRepiqueUseCase,
    RepiqueInatividadeScheduler,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma).
    { provide: 'IPipelineRepository', useClass: PrismaPipelineRepository },
    { provide: 'IStageRepository', useClass: PrismaStageRepository },
    { provide: 'ICardRepository', useClass: PrismaCardRepository },
    { provide: 'IActivityRepository', useClass: PrismaActivityRepository },
    { provide: 'INoteRepository', useClass: PrismaNoteRepository },
  ],
  // Exportados para o modulo vivi_sdr: a VIVI cria o Card e a Note de
  // qualificacao reaproveitando os mesmos casos de uso do "+ Novo Negocio";
  // CreateActivityUseCase reaproveitado pela tool "agendar_visita"
  // (AgendarVisitaUseCase) para criar a Activity tipo "visita".
  // Exportados para o modulo roleta_online: DistributeLeadUseCase e
  // ConfirmSuggestedOwnerUseCase reaproveitam ClaimCardUseCase (mesma logica
  // de "assumir o lead") e os repositorios de Card/Stage.
  exports: [
    CreateQuickCardUseCase,
    CreateNoteUseCase,
    ClaimCardUseCase,
    CreateActivityUseCase,
    'IPipelineRepository',
    'ICardRepository',
    'IStageRepository',
  ],
})
export class VendasKanbanModule {}
