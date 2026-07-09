// src/modules/vendas_kanban/infra/database/prisma-card.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import {
  ICardRepository,
  CardRecord,
} from '../../domain/repositories/card-repository.interface';

type PrismaCardRow = {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string | null;
  ownerId: string | null;
  suggestedOwnerId: string | null;
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
  customFields: unknown;
  createdAt: Date;
  updatedAt: Date;
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
      customFields: (row.customFields as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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
    customFields?: Record<string, unknown>;
  }): Promise<CardRecord> {
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
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.toRecord(row);
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
    });
    return rows.map((row) => this.toRecord(row));
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

  async updateStageAndPosition(id: string, stageId: string, position: number): Promise<void> {
    await this.prisma.card.update({ where: { id }, data: { stageId, position } });
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
}
