// src/modules/vendas_kanban/infra/database/prisma-stage.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IStageRepository,
  StageRecord,
} from '../../domain/repositories/stage-repository.interface';

@Injectable()
export class PrismaStageRepository implements IStageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    pipelineId: string;
    name: string;
    position: number;
  }): Promise<StageRecord> {
    return this.prisma.stage.create({
      data: {
        tenantId: input.tenantId,
        pipelineId: input.pipelineId,
        name: input.name,
        position: input.position,
      },
    });
  }

  async findById(id: string): Promise<StageRecord | null> {
    return this.prisma.stage.findUnique({ where: { id } });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<StageRecord | null> {
    return this.prisma.stage.findFirst({ where: { id, tenantId } });
  }

  async findAllByPipeline(pipelineId: string): Promise<StageRecord[]> {
    return this.prisma.stage.findMany({
      where: { pipelineId },
      orderBy: { position: 'asc' },
    });
  }

  async updatePosition(id: string, position: number): Promise<void> {
    await this.prisma.stage.update({ where: { id }, data: { position } });
  }

  async updateName(id: string, name: string): Promise<void> {
    await this.prisma.stage.update({ where: { id }, data: { name } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.stage.delete({ where: { id } });
  }
}
