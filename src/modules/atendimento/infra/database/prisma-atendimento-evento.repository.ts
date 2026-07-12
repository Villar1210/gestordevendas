// src/modules/atendimento/infra/database/prisma-atendimento-evento.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IAtendimentoEventoRepository,
  AtendimentoEventoRecord,
} from '../../domain/repositories/atendimento-evento-repository.interface';

@Injectable()
export class PrismaAtendimentoEventoRepository implements IAtendimentoEventoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    atendimentoId: string;
    tipo: string;
    userId?: string | null;
    detalhe?: string | null;
  }): Promise<AtendimentoEventoRecord> {
    const row = await this.prisma.atendimentoEvento.create({
      data: {
        atendimentoId: input.atendimentoId,
        tipo: input.tipo,
        userId: input.userId ?? null,
        detalhe: input.detalhe ?? null,
      },
      include: { user: { select: { name: true } } },
    });
    const { user, ...rest } = row;
    return { ...rest, userName: user?.name ?? null };
  }

  async findAllByAtendimento(atendimentoId: string): Promise<AtendimentoEventoRecord[]> {
    const rows = await this.prisma.atendimentoEvento.findMany({
      where: { atendimentoId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true } } },
    });
    return rows.map(({ user, ...rest }) => ({ ...rest, userName: user?.name ?? null }));
  }
}
