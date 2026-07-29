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

  async findPendingByCardAndType(
    tenantId: string,
    cardId: string,
    type: string,
  ): Promise<ActivityRecord | null> {
    return this.prisma.activity.findFirst({
      where: { tenantId, cardId, type, done: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    input: { subject: string | null; scheduledAt: Date | null },
  ): Promise<ActivityRecord> {
    return this.prisma.activity.update({
      where: { id },
      data: { subject: input.subject, scheduledAt: input.scheduledAt },
    });
  }

  async findPendingTodayByOwner(tenantId: string, ownerId: string): Promise<ActivityRecord[]> {
    const now = new Date();
    // new Date(year, month, day) usa o fuso LOCAL do processo - mesma
    // tecnica ja usada em shared/utils/date-only.util.ts para evitar o bug
    // de fuso horario documentado em CLAUDE.md.
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const rows = await this.prisma.activity.findMany({
      where: {
        tenantId,
        done: false,
        scheduledAt: { gte: startOfToday, lt: startOfTomorrow },
        card: { ownerId },
      },
      orderBy: { scheduledAt: 'asc' },
      include: { card: { select: { title: true, pipelineId: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      cardId: row.cardId,
      type: row.type,
      subject: row.subject,
      scheduledAt: row.scheduledAt,
      done: row.done,
      createdAt: row.createdAt,
      cardTitle: row.card.title,
      cardPipelineId: row.card.pipelineId,
    }));
  }

  async findProximasByCardIds(
    cardIds: string[],
  ): Promise<Array<{ cardId: string; type: string; subject: string | null; scheduledAt: Date }>> {
    if (cardIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.activity.findMany({
      where: { cardId: { in: cardIds }, done: false, scheduledAt: { not: null } },
      orderBy: { scheduledAt: 'asc' },
    });

    // scheduledAt no passado ordena antes de scheduledAt no futuro - o
    // primeiro registro encontrado por cardId ja e o mais urgente (a mais
    // atrasada, se houver alguma vencida; senao a mais proxima).
    const porCard = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!porCard.has(row.cardId)) {
        porCard.set(row.cardId, row);
      }
    }

    return Array.from(porCard.values()).map((row) => ({
      cardId: row.cardId,
      type: row.type,
      subject: row.subject,
      scheduledAt: row.scheduledAt as Date,
    }));
  }

  async findUltimasByCardIds(
    cardIds: string[],
  ): Promise<Array<{ cardId: string; ultimaAtividadeEm: Date }>> {
    if (cardIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.activity.findMany({
      where: { cardId: { in: cardIds } },
      orderBy: { createdAt: 'desc' },
    });

    // Para cada cardId, pegar apenas a primeira atividade (mais recente por createdAt)
    const porCard = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!porCard.has(row.cardId)) {
        porCard.set(row.cardId, row);
      }
    }

    return Array.from(porCard.values()).map((row) => ({
      cardId: row.cardId,
      ultimaAtividadeEm: row.createdAt,
    }));
  }
}
