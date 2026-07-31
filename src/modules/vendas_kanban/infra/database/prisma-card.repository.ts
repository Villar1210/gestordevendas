// src/modules/vendas_kanban/infra/database/prisma-card.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';
import {
  ICardRepository,
  CardRecord,
} from '../../domain/repositories/card-repository.interface';
import { PROTECTED_STAGE_NAMES, REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';
import { REMARKETING_PIPELINE_NOME } from '../../domain/services/remarketing-pipeline';

type PrismaCardRow = {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string | null;
  ownerId: string | null;
  suggestedOwnerId: string | null;
  atribuidoAutomaticamenteEm: Date | null;
  aceitoEm: Date | null;
  motivoRepique: string | null;
  movidoParaRepiqueEm: Date | null;
  repiqueOptOut: boolean;
  repiqueOptOutToken: string | null;
  imovelId: string | null;
  title: string;
  value: { toNumber(): number };
  position: number;
  origem: string;
  phone: string | null;
  temperatura: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  description: string | null;
  customFields: unknown;
  createdAt: Date;
  updatedAt: Date;
  escalonamentoNotificadoEm: Date | null;
};

@Injectable()
export class PrismaCardRepository implements ICardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: PrismaCardRow): CardRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      pipelineId: row.pipelineId,
      stageId: row.stageId,
      ownerId: row.ownerId,
      // So preenchido pela consulta da Caixa de Entrada (findAllByPipelineInbox),
      // que faz o join com o nome do corretor sugerido.
      suggestedOwnerId: row.suggestedOwnerId,
      suggestedOwnerName: null,
      atribuidoAutomaticamenteEm: row.atribuidoAutomaticamenteEm,
      aceitoEm: row.aceitoEm,
      motivoRepique: row.motivoRepique,
      movidoParaRepiqueEm: row.movidoParaRepiqueEm,
      repiqueOptOut: row.repiqueOptOut,
      repiqueOptOutToken: row.repiqueOptOutToken,
      stageName: null,
      ownerName: null,
      imovelId: row.imovelId,
      title: row.title,
      value: row.value.toNumber(),
      position: row.position,
      origem: row.origem,
      phone: row.phone,
      temperatura: row.temperatura,
      email: row.email,
      endereco: row.endereco,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      cep: row.cep,
      description: row.description,
      customFields: (row.customFields as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      escalonamentoNotificadoEm: row.escalonamentoNotificadoEm,
      // Preenchida so pelo use case (GetBoardUseCase/GetInboxUseCase), apos
      // uma consulta em lote a IActivityRepository - ver CardRecord.
      proximaAtividade: null,
    };
  }

  async create(input: {
    tenantId: string;
    pipelineId: string;
    stageId?: string | null;
    ownerId?: string | null;
    imovelId?: string | null;
    title: string;
    value?: number;
    position: number;
    origem?: string;
    phone?: string | null;
    temperatura?: string | null;
    description?: string | null;
    customFields?: Record<string, unknown>;
    motivoRepique?: string | null;
    movidoParaRepiqueEm?: Date | null;
  }): Promise<CardRecord> {
    try {
      const row = await this.prisma.card.create({
        data: {
          tenantId: input.tenantId,
          pipelineId: input.pipelineId,
          stageId: input.stageId ?? null,
          ownerId: input.ownerId ?? null,
          imovelId: input.imovelId ?? null,
          title: input.title,
          value: input.value ?? 0,
          position: input.position,
          origem: input.origem ?? 'manual',
          phone: input.phone ?? null,
          temperatura: input.temperatura ?? null,
          description: input.description ?? null,
          customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
          motivoRepique: input.motivoRepique ?? null,
          movidoParaRepiqueEm: input.movidoParaRepiqueEm ?? null,
        },
      });
      return this.toRecord(row);
    } catch (error) {
      // Indice unico parcial "cards_captura_auto_vivi_tenant_phone_key"
      // (ver schema.prisma) - so pode disparar quando origem="captura_auto_vivi"
      // (ver CapturarLeadMinimoUseCase); Cards de outras origens nunca violam
      // esse indice, ja que o WHERE do indice nao os cobre.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UniqueConstraintViolationError(
          'Ja existe um Card de captura automatica para este tenant+telefone.',
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<CardRecord | null> {
    const row = await this.prisma.card.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<CardRecord | null> {
    const row = await this.prisma.card.findFirst({ where: { id, tenantId } });
    return row ? this.toRecord(row) : null;
  }

  async findAllByStage(stageId: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { stageId },
      orderBy: { position: 'asc' },
      include: { owner: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...this.toRecord(row),
      ownerName: row.owner?.name ?? null,
    }));
  }

  async findAllByPipelineInbox(pipelineId: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { pipelineId, stageId: null },
      orderBy: { createdAt: 'asc' },
      include: { suggestedOwner: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...this.toRecord(row),
      suggestedOwnerName: row.suggestedOwner?.name ?? null,
    }));
  }

  async findAllInboxByTenant(tenantId: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { tenantId, stageId: null, ownerId: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findAllByTenantAndEmail(tenantId: string, email: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { tenantId, email },
      orderBy: { createdAt: 'desc' },
      include: { stage: { select: { name: true } }, owner: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...this.toRecord(row),
      stageName: row.stage?.name ?? null,
      ownerName: row.owner?.name ?? null,
    }));
  }

  async countByOwnerGroupedByStage(
    tenantId: string,
    ownerId: string,
  ): Promise<Array<{ stageId: string; stageName: string; position: number; count: number }>> {
    const groups = await this.prisma.card.groupBy({
      by: ['stageId'],
      // Escopo de metrica pessoal de vendas, nao RBAC - leads brutos do
      // funil de remarketing (ver domain/services/remarketing-pipeline.ts)
      // nunca contam para o Dashboard do Corretor, mesmo se algum dia
      // tiverem ownerId preenchido, nem mesmo para um Administrador.
      where: {
        tenantId,
        ownerId,
        stageId: { not: null },
        pipeline: { name: { not: REMARKETING_PIPELINE_NOME } },
      },
      _count: { _all: true },
    });
    if (groups.length === 0) return [];

    const stageIds = groups.map((g) => g.stageId as string);
    const stages = await this.prisma.stage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, position: true },
    });
    const stageById = new Map(stages.map((s) => [s.id, s]));

    return groups
      .map((g) => {
        const stage = stageById.get(g.stageId as string);
        return {
          stageId: g.stageId as string,
          stageName: stage?.name ?? 'Etapa removida',
          position: stage?.position ?? 0,
          count: g._count._all,
        };
      })
      .sort((a, b) => a.position - b.position);
  }

  async findRecentByOwner(tenantId: string, ownerId: string, limit: number): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      // Mesmo escopo estrutural de countByOwnerGroupedByStage acima - leads
      // do funil de remarketing nunca aparecem no Dashboard do Corretor.
      where: {
        tenantId,
        ownerId,
        pipeline: { name: { not: REMARKETING_PIPELINE_NOME } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { stage: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...this.toRecord(row),
      stageName: row.stage?.name ?? null,
    }));
  }

  async updateSuggestedOwner(id: string, suggestedOwnerId: string | null): Promise<CardRecord> {
    const row = await this.prisma.card.update({ where: { id }, data: { suggestedOwnerId } });
    return this.toRecord(row);
  }

  async countActiveByOwnerInStages(input: {
    tenantId: string;
    ownerId: string;
    stageIds: string[];
  }): Promise<number> {
    return this.prisma.card.count({
      where: {
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        stageId: { in: input.stageIds },
      },
    });
  }

  async updateStageAndPosition(
    id: string,
    stageId: string,
    position: number,
    extra?: { motivoRepique?: string; movidoParaRepiqueEm?: Date },
  ): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: {
        stageId,
        position,
        ...(extra?.motivoRepique !== undefined ? { motivoRepique: extra.motivoRepique } : {}),
        ...(extra?.movidoParaRepiqueEm !== undefined
          ? { movidoParaRepiqueEm: extra.movidoParaRepiqueEm }
          : {}),
      },
    });
  }

  async markAtribuidoAutomaticamente(id: string, when: Date): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: { atribuidoAutomaticamenteEm: when, aceitoEm: null },
    });
  }

  async aceitarLead(id: string, when: Date): Promise<CardRecord> {
    const row = await this.prisma.card.update({ where: { id }, data: { aceitoEm: when } });
    return this.toRecord(row);
  }

  async reassignOwnerAfterTimeout(id: string, newOwnerId: string, when: Date): Promise<CardRecord> {
    const row = await this.prisma.card.update({
      where: { id },
      data: { ownerId: newOwnerId, atribuidoAutomaticamenteEm: when, aceitoEm: null },
    });
    return this.toRecord(row);
  }

  async clearAtribuidoAutomaticamente(id: string): Promise<void> {
    await this.prisma.card.update({ where: { id }, data: { atribuidoAutomaticamenteEm: null } });
  }

  async findPendentesDeAceite(): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { atribuidoAutomaticamenteEm: { not: null }, aceitoEm: null },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findElegiveisParaRepiqueJob(antesDe: Date): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: {
        updatedAt: { lt: antesDe },
        OR: [{ stageId: null }, { stage: { name: { notIn: PROTECTED_STAGE_NAMES } } }],
      },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findElegiveisParaCampanhaRepique(): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { stage: { name: REPIQUE_STAGE_NAME }, repiqueOptOut: false },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findInboxUnnotifiedOlderThan(antesDe: Date): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: {
        stageId: null,
        ownerId: null,
        createdAt: { lt: antesDe },
        escalonamentoNotificadoEm: null,
      },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async markEscalonamentoNotificado(id: string): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: { escalonamentoNotificadoEm: new Date() },
    });
  }

  async findRepiqueCardByTenantAndPhone(tenantId: string, phone: string): Promise<CardRecord | null> {
    const row = await this.prisma.card.findFirst({
      where: { tenantId, phone, stage: { name: REPIQUE_STAGE_NAME } },
    });
    return row ? this.toRecord(row) : null;
  }

  async findByRepiqueOptOutToken(token: string): Promise<CardRecord | null> {
    const row = await this.prisma.card.findUnique({ where: { repiqueOptOutToken: token } });
    return row ? this.toRecord(row) : null;
  }

  async markRepiqueOptOut(id: string): Promise<void> {
    await this.prisma.card.update({ where: { id }, data: { repiqueOptOut: true } });
  }

  async setRepiqueOptOutToken(id: string, token: string): Promise<void> {
    await this.prisma.card.update({ where: { id }, data: { repiqueOptOutToken: token } });
  }

  async assignOwnerAndStage(
    id: string,
    input: { ownerId: string; stageId: string; position: number },
  ): Promise<CardRecord> {
    const row = await this.prisma.card.update({
      where: { id },
      data: { ownerId: input.ownerId, stageId: input.stageId, position: input.position },
    });
    return this.toRecord(row);
  }

  async update(
    id: string,
    input: {
      title?: string;
      value?: number;
      phone?: string | null;
      temperatura?: string | null;
      email?: string | null;
      endereco?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cep?: string | null;
      imovelId?: string | null;
      customFields?: Record<string, unknown>;
    },
  ): Promise<CardRecord> {
    const row = await this.prisma.card.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.temperatura !== undefined ? { temperatura: input.temperatura } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.endereco !== undefined ? { endereco: input.endereco } : {}),
        ...(input.numero !== undefined ? { numero: input.numero } : {}),
        ...(input.complemento !== undefined ? { complemento: input.complemento } : {}),
        ...(input.bairro !== undefined ? { bairro: input.bairro } : {}),
        ...(input.cep !== undefined ? { cep: input.cep } : {}),
        ...(input.imovelId !== undefined ? { imovelId: input.imovelId } : {}),
        ...(input.customFields !== undefined
          ? { customFields: input.customFields as Prisma.InputJsonValue }
          : {}),
      },
    });
    return this.toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.card.delete({ where: { id } });
  }


  async existsByTenantAndPhoneWithOwner(tenantId: string, phone: string): Promise<boolean> {
    const count = await this.prisma.card.count({
      where: {
        tenantId,
        phone,
        ownerId: { not: null },
      },
    });
    return count > 0;
  }

  async existsByTenantAndPhone(tenantId: string, phone: string): Promise<boolean> {
    const count = await this.prisma.card.count({ where: { tenantId, phone } });
    return count > 0;
  }

  async findByTenantPhoneAndPipeline(
    tenantId: string,
    phone: string,
    pipelineId: string,
  ): Promise<CardRecord | null> {
    const row = await this.prisma.card.findFirst({ where: { tenantId, phone, pipelineId } });
    return row ? this.toRecord(row) : null;
  }

  async moveToPipelineAndStage(
    id: string,
    input: {
      pipelineId: string;
      stageId: string | null;
      position: number;
      title?: string;
      description?: string;
      origem?: string;
      motivoRepique?: string | null;
      movidoParaRepiqueEm?: Date | null;
    },
  ): Promise<CardRecord> {
    const row = await this.prisma.card.update({
      where: { id },
      data: {
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        position: input.position,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.origem !== undefined ? { origem: input.origem } : {}),
        ...(input.motivoRepique !== undefined ? { motivoRepique: input.motivoRepique } : {}),
        ...(input.movidoParaRepiqueEm !== undefined
          ? { movidoParaRepiqueEm: input.movidoParaRepiqueEm }
          : {}),
      },
    });
    return this.toRecord(row);
  }
}
