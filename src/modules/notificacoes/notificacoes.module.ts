// src/modules/notificacoes/notificacoes.module.ts
import { Module } from '@nestjs/common';
import { NotificationController } from './infra/http/notification.controller';
import { ListMyNotificationsUseCase } from './application/use-cases/list-my-notifications.use-case';
import { MarkNotificationReadUseCase } from './application/use-cases/mark-notification-read.use-case';
import { CreateNotificationUseCase } from './application/use-cases/create-notification.use-case';
import { CadastroPendenteCriadoListener } from './infra/listeners/cadastro-pendente-criado.listener';
import { PrismaNotificationRepository } from './infra/database/prisma-notification.repository';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Dependencia de modulo (nao circular): notificacoes consome
  // IUserRepository ja exportado por AuthModule para encontrar os
  // Administradores de um tenant (ver CadastroPendenteCriadoListener). O
  // caminho inverso (rh -> notificacoes) nao existe - rh so emite o evento
  // generico 'cadastro.pendente.criado', sem conhecer quem escuta (mesmo
  // padrao ja usado por roleta_online/vivi_sdr).
  imports: [AuthModule],
  controllers: [NotificationController],
  providers: [
    PrismaService,
    ListMyNotificationsUseCase,
    MarkNotificationReadUseCase,
    CreateNotificationUseCase,
    CadastroPendenteCriadoListener,
    { provide: 'INotificationRepository', useClass: PrismaNotificationRepository },
  ],
})
export class NotificacoesModule {}
