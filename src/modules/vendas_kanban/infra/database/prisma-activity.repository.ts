// src/modules/vendas_kanban/infra/database/prisma-activity.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IActivityRepository,
  ActivityRecord,
} from '../../domain/repositories/activity-repository.interface';

@Injectable()
export class PrismaActivityRepository implements IActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    cardId: string;
    type: string;
    subject?: string | null;
    scheduledAt?: Date | null;
  }): Promise<ActivityRecord> {
    return this.prisma.activity.create({
      data: {
        tenantId: input.tenantId,
        cardId: input.cardId,
        type: input.type,
        subject: input.subject ?? null,
        scheduledAt: input.scheduledAt ?? null,
      },
    });
  }

  async findById(id: string): Promise<ActivityRecord | null> {
    return this.prisma.activity.findUnique({ where: { id } });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<ActivityRecord | null> {
    return this.prisma.activity.findFirst({ where: { id, tenantId } });
  }

  async findAllByCard(cardId: string): Promise<ActivityRecord[]> {
    return this.prisma.activity.findMany({
      where: { cardId },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async setDone(id: string, done: boolean): Promise<ActivityRecord> {
    return this.prisma.activity.update({ where: { id }, data: { done } });
  }
}
