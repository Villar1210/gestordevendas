// src/modules/notificacoes/application/use-cases/mark-notification-read.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  INotificationRepository,
  NotificationRecord,
} from '../../domain/repositories/notification-repository.interface';

interface MarkNotificationReadInput {
  notificationId: string;
  userId: string;
}

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(
    @Inject('INotificationRepository') private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(input: MarkNotificationReadInput): Promise<NotificationRecord> {
    // findByIdAndUser ja garante que a notificacao pertence a quem esta
    // pedindo - impede marcar como lida a notificacao de outro usuario.
    const notification = await this.notificationRepository.findByIdAndUser(
      input.notificationId,
      input.userId,
    );
    if (!notification) {
      throw new NotFoundException('Notificacao nao encontrada.');
    }

    return this.notificationRepository.markAsRead(input.notificationId);
  }
}
