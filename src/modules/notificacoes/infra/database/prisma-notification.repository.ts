// src/modules/notificacoes/infra/database/prisma-notification.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  INotificationRepository,
  NotificationRecord,
} from '../../domain/repositories/notification-repository.interface';

@Injectable()
export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    userId: string;
    tipo: string;
    mensagem: string;
    link?: string | null;
  }): Promise<NotificationRecord> {
    return this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        tipo: input.tipo,
        mensagem: input.mensagem,
        link: input.link ?? null,
      },
    });
  }

  async findAllByUser(tenantId: string, userId: string): Promise<NotificationRecord[]> {
    return this.prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findByIdAndUser(id: string, userId: string): Promise<NotificationRecord | null> {
    return this.prisma.notification.findFirst({ where: { id, userId } });
  }

  async markAsRead(id: string): Promise<NotificationRecord> {
    return this.prisma.notification.update({
      where: { id },
      data: { lida: true },
    });
  }
}
