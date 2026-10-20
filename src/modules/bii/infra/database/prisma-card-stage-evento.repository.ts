// src/modules/bii/infra/database/prisma-card-stage-evento.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ICardStageEventoRepository,
  NovoCardStageEvento,
} from '../../domain/repositories/card-stage-evento-repository.interface';

@Injectable()
export class PrismaCardStageEventoRepository implements ICardStageEventoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarNomesEtapas(tenantId: string, stageIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(stageIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.stage.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async cardPertenceAoTenant(tenantId: string, cardId: string): Promise<boolean> {
    const n = await this.prisma.card.count({ where: { id: cardId, tenantId } });
    return n > 0;
  }

  async registrar(e: NovoCardStageEvento): Promise<void> {
    await this.prisma.biiCardStageEvento.create({
      data: {
        tenantId: e.tenantId,
        cardId: e.cardId,
        pipelineId: e.pipelineId,
        fromStageId: e.fromStageId,
        toStageId: e.toStageId,
        fromStageNome: e.fromStageNome,
        toStageNome: e.toStageNome,
        userId: e.userId,
        origem: e.origem,
        motivoRepique: e.motivoRepique,
        ocorridoEm: e.ocorridoEm,
      },
    });
  }
}
