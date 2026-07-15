// src/modules/notificacoes/application/use-cases/list-my-notifications.use-case.ts
// Sino da Topbar - qualquer usuario logado ve so as PROPRIAS notificacoes
// (ja filtradas por userId no repositorio, sem checagem de role adicional -
// mesmo padrao aberto de GET /auth/me).
import { Injectable, Inject } from '@nestjs/common';
import {
  INotificationRepository,
  NotificationRecord,
} from '../../domain/repositories/notification-repository.interface';

interface ListMyNotificationsInput {
  tenantId: string;
  userId: string;
}

@Injectable()
export class ListMyNotificationsUseCase {
  constructor(
    @Inject('INotificationRepository') private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(input: ListMyNotificationsInput): Promise<NotificationRecord[]> {
    return this.notificationRepository.findAllByUser(input.tenantId, input.userId);
  }
}
