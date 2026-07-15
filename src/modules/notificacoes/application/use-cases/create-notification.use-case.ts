// src/modules/notificacoes/application/use-cases/create-notification.use-case.ts
// Caso de uso generico, chamado pelos listeners de evento deste modulo (ver
// infra/listeners/) - nunca chamado diretamente por um controller (nao ha
// rota HTTP para "criar notificacao manualmente" nesta fatia).
import { Injectable, Inject } from '@nestjs/common';
import {
  INotificationRepository,
  NotificationRecord,
} from '../../domain/repositories/notification-repository.interface';

interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  tipo: string;
  mensagem: string;
  link?: string | null;
}

@Injectable()
export class CreateNotificationUseCase {
  constructor(
    @Inject('INotificationRepository') private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(input: CreateNotificationInput): Promise<NotificationRecord> {
    return this.notificationRepository.create(input);
  }
}
