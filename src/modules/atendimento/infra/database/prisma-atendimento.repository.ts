// src/modules/atendimento/infra/database/prisma-atendimento.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
  AtendimentoWithNames,
  ListAtendimentosFilter,
} from '../../domain/repositories/atendimento-repository.interface';

@Injectable()
export class PrismaAtendimentoRepository implements IAtendimentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    whatsappSessionId: string;
    remoteJid: string;
    phoneNumber: string;
  }): Promise<AtendimentoRecord> {
    return this.prisma.atendimento.create({ data: input });
  }

  async findActiveBySessionAndRemoteJid(
    sessionId: string,
    remoteJid: string,
  ): Promise<AtendimentoRecord | null> {
    return this.prisma.atendimento.findFirst({
      where: { whatsappSessionId: sessionId, remoteJid, status: { not: 'fechado' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<AtendimentoRecord | null> {
    return this.prisma.atendimento.findFirst({ where: { id, tenantId } });
  }

  async update(
    id: string,
    data: Partial<{
      filaId: string | null;
      ownerId: string | null;
      status: string;
      motivoFechamento: string | null;
      closedAt: Date | null;
    }>,
  ): Promise<AtendimentoRecord> {
    return this.prisma.atendimento.update({ where: { id }, data });
  }

  async findAllByTenant(
    tenantId: string,
    filter: ListAtendimentosFilter,
  ): Promise<AtendimentoWithNames[]> {
    const where: Prisma.AtendimentoWhereInput = {
      tenantId,
      ...(filter.filaId ? { filaId: filter.filaId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
      ...(filter.visibleFilaIds !== undefined
        ? { OR: [{ filaId: { in: filter.visibleFilaIds } }, { ownerId: { in: filter.visibleOwnerIds } } ] }
        : {}),
    };

    const rows = await this.prisma.atendimento.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { fila: { select: { nome: true } }, owner: { select: { name: true } } },
    });

    return rows.map(({ fila, owner, ...row }) => ({
      ...row,
      filaNome: fila?.nome ?? null,
      ownerName: owner?.name ?? null,
    }));
  }
}
