// src/modules/vendas_kanban/infra/database/prisma-pipeline.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IPipelineRepository,
  PipelineRecord,
} from '../../domain/repositories/pipeline-repository.interface';

@Injectable()
export class PrismaPipelineRepository implements IPipelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { tenantId: string; name: string }): Promise<PipelineRecord> {
    return this.prisma.pipeline.create({
      data: { tenantId: input.tenantId, name: input.name },
    });
  }

  async findById(id: string): Promise<PipelineRecord | null> {
    return this.prisma.pipeline.findUnique({ where: { id } });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<PipelineRecord | null> {
    return this.prisma.pipeline.findFirst({ where: { id, tenantId } });
  }

  async findAllByTenant(tenantId: string): Promise<PipelineRecord[]> {
    return this.prisma.pipeline.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
