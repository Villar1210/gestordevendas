// src/modules/bii/infra/database/prisma-painel-vendas.repository.ts
// Leituras do Painel de Vendas sobre Card/Stage/Pipeline/User (tabelas do
// kanban/auth, lidas por repositorio PROPRIO do BII - sem importar nada do
// vendas_kanban). TODA consulta tem tenantId no where (inclusive nas relacoes
// filtradas). So Prisma tipado (findMany/groupBy/aggregate) - nenhum SQL bruto.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import {
  CardCriadoRow,
  EventoEntradaRow,
  FiltroPainel,
  IdNome,
  IPainelVendasRepository,
} from '../../domain/repositories/painel-vendas-repository.interface';

@Injectable()
export class PrismaPainelVendasRepository implements IPainelVendasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPipelines(tenantId: string): Promise<IdNome[]> {
    const rows = await this.prisma.pipeline.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, nome: r.name }));
  }

  async listarEtapas(tenantId: string, pipelineId: string): Promise<IdNome[]> {
    const rows = await this.prisma.stage.findMany({
      where: { tenantId, pipelineId },
      select: { id: true, name: true },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, nome: r.name }));
  }

  async listarCorretores(tenantId: string, pipelineId: string): Promise<IdNome[]> {
    const rows = await this.prisma.user.findMany({
      where: { tenantId, ownedCards: { some: { tenantId, pipelineId } } },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, nome: r.name }));
  }

  async listarOrigens(tenantId: string, pipelineId: string): Promise<string[]> {
    const rows = await this.prisma.card.groupBy({
      by: ['origem'],
      where: { tenantId, pipelineId },
      orderBy: { origem: 'asc' },
    });
    return rows.map((r) => r.origem);
  }

  async buscarInicioHistorico(tenantId: string): Promise<Date | null> {
    const r = await this.prisma.biiCardStageEvento.aggregate({
      where: { tenantId },
      _min: { ocorridoEm: true },
    });
    return r._min.ocorridoEm ?? null;
  }

  private filtroCard(f: FiltroPainel): Prisma.CardWhereInput {
    return {
      tenantId: f.tenantId,
      ...(f.corretorId ? { ownerId: f.corretorId } : {}),
      ...(f.origem ? { origem: f.origem } : {}),
    };
  }

  async listarCardsCriados(f: FiltroPainel): Promise<CardCriadoRow[]> {
    const rows = await this.prisma.card.findMany({
      where: {
        ...this.filtroCard(f),
        pipelineId: f.pipelineId,
        createdAt: { gte: f.inicio, lt: f.fimExclusivo },
      },
      select: { id: true, ownerId: true, origem: true, createdAt: true },
    });
    return rows.map((r) => ({ cardId: r.id, ownerId: r.ownerId, origem: r.origem, createdAt: r.createdAt }));
  }

  async listarEventosEntrada(f: FiltroPainel): Promise<EventoEntradaRow[]> {
    const rows = await this.prisma.biiCardStageEvento.findMany({
      where: {
        tenantId: f.tenantId,
        pipelineId: f.pipelineId,
        ocorridoEm: { gte: f.inicio, lt: f.fimExclusivo },
        card: this.filtroCard(f),
      },
      select: {
        cardId: true,
        toStageId: true,
        toStageNome: true,
        motivoRepique: true,
        ocorridoEm: true,
        card: { select: { ownerId: true, origem: true, value: true, createdAt: true } },
      },
      orderBy: { ocorridoEm: 'asc' },
    });
    return rows.map((r) => ({
      cardId: r.cardId,
      toStageId: r.toStageId,
      toStageNome: r.toStageNome,
      motivoRepique: r.motivoRepique,
      ocorridoEm: r.ocorridoEm,
      card: {
        ownerId: r.card.ownerId,
        origem: r.card.origem,
        value: r.card.value === null || r.card.value === undefined ? 0 : Number(r.card.value),
        createdAt: r.card.createdAt,
      },
    }));
  }
}
