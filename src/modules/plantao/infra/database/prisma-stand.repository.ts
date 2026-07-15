// src/modules/plantao/infra/database/prisma-stand.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { IStandRepository, StandRecord } from '../../domain/repositories/stand-repository.interface';

@Injectable()
export class PrismaStandRepository implements IStandRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { tenantId: string; nome: string; endereco?: string | null }): Promise<StandRecord> {
    return this.prisma.stand.create({
      data: { tenantId: input.tenantId, nome: input.nome, endereco: input.endereco ?? null },
    });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<StandRecord | null> {
    return this.prisma.stand.findFirst({ where: { id, tenantId } });
  }

  async findAllByTenant(tenantId: string): Promise<StandRecord[]> {
    return this.prisma.stand.findMany({ where: { tenantId }, orderBy: { nome: 'asc' } });
  }

  async update(
    id: string,
    input: { nome: string; endereco?: string | null; ativo: boolean },
  ): Promise<StandRecord> {
    return this.prisma.stand.update({
      where: { id },
      data: { nome: input.nome, endereco: input.endereco ?? null, ativo: input.ativo },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.stand.delete({ where: { id } });
  }

  async countEscalasByStand(standId: string): Promise<number> {
    return this.prisma.escalaPlantao.count({ where: { standId } });
  }

  async countCoordenadoresByStand(standId: string): Promise<number> {
    return this.prisma.user.count({ where: { standId } });
  }
}
