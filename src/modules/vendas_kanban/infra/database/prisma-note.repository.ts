// src/modules/vendas_kanban/infra/database/prisma-note.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { INoteRepository, NoteRecord } from '../../domain/repositories/note-repository.interface';

@Injectable()
export class PrismaNoteRepository implements INoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { tenantId: string; cardId: string; body: string }): Promise<NoteRecord> {
    return this.prisma.note.create({
      data: {
        tenantId: input.tenantId,
        cardId: input.cardId,
        body: input.body,
      },
    });
  }

  async findAllByCard(cardId: string): Promise<NoteRecord[]> {
    return this.prisma.note.findMany({
      where: { cardId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
