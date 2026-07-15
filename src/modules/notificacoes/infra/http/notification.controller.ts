// src/modules/notificacoes/infra/http/notification.controller.ts
// Sino da Topbar - qualquer usuario autenticado (sem @Roles) ve so as
// PROPRIAS notificacoes, filtradas por userId no proprio use case.
import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { ListMyNotificationsUseCase } from '../../application/use-cases/list-my-notifications.use-case';
import { MarkNotificationReadUseCase } from '../../application/use-cases/mark-notification-read.use-case';

@Controller('notificacoes')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly listMyNotificationsUseCase: ListMyNotificationsUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
  ) {}

  // GET /notificacoes - as ultimas notificacoes do usuario logado (mais
  // recentes primeiro) - o frontend calcula o contador de nao lidas a
  // partir da propria lista (campo "lida" por item).
  @Get()
  async list(@Req() req: Request) {
    return this.listMyNotificationsUseCase.execute({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
    });
  }

  // PATCH /notificacoes/:id/marcar-lida
  @Patch(':id/marcar-lida')
  async markAsRead(@Param('id') id: string, @Req() req: Request) {
    return this.markNotificationReadUseCase.execute({
      notificationId: id,
      userId: req.user!.id,
    });
  }
}
