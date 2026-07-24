// src/modules/notificacoes/notificacoes.module.ts
import { Module } from '@nestjs/common';
import { NotificationController } from './infra/http/notification.controller';
import { ListMyNotificationsUseCase } from './application/use-cases/list-my-notifications.use-case';
import { MarkNotificationReadUseCase } from './application/use-cases/mark-notification-read.use-case';
import { CreateNotificationUseCase } from './application/use-cases/create-notification.use-case';
import { CadastroPendenteCriadoListener } from './infra/listeners/cadastro-pendente-criado.listener';
import { LeadAtribuidoListener } from './infra/listeners/lead-atribuido.listener';
import { AtendimentoClassificadoListener } from './infra/listeners/atendimento-classificado.listener';
import { PrismaNotificationRepository } from './infra/database/prisma-notification.repository';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { VendasKanbanModule } from '../vendas_kanban/vendas-kanban.module';
import { AtendimentoModule } from '../atendimento/atendimento.module';

@Module({
  // Dependencia de modulo (nao circular): notificacoes consome
  // IUserRepository ja exportado por AuthModule para encontrar os
  // Administradores de um tenant (ver CadastroPendenteCriadoListener),
  // ICardRepository/IStageRepository ja exportados por VendasKanbanModule
  // para montar a mensagem/link do lead atribuido (ver
  // LeadAtribuidoListener), e IFilaRepository ja exportado por
  // AtendimentoModule para notificar os usuarios de uma fila (ver
  // AtendimentoClassificadoListener - handoff VIVI -> Corretor). O caminho
  // inverso (rh/roleta_online/atendimento -> notificacoes) nao existe - os
  // tres so emitem eventos genericos ('cadastro.pendente.criado'/
  // 'lead.atribuido'/'atendimento.classificado'), sem conhecer quem escuta
  // (mesmo padrao ja usado por roleta_online/vivi_sdr).
  imports: [AuthModule, VendasKanbanModule, AtendimentoModule],
  controllers: [NotificationController],
  providers: [
    PrismaService,
    ListMyNotificationsUseCase,
    MarkNotificationReadUseCase,
    CreateNotificationUseCase,
    CadastroPendenteCriadoListener,
    LeadAtribuidoListener,
    AtendimentoClassificadoListener,
    { provide: 'INotificationRepository', useClass: PrismaNotificationRepository },
  ],
})
export class NotificacoesModule {}
