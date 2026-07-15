// src/modules/vivi_sdr/infra/database/prisma-vivi-config.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IViviConfigRepository,
  ViviConfigRecord,
} from '../../domain/repositories/vivi-config-repository.interface';

type PrismaViviConfig = {
  id: string;
  tenantId: string;
  precoMinimo: { toNumber(): number };
  limiteSemPerfil: { toNumber(): number };
  limiteHis1: { toNumber(): number };
  limiteHis2: { toNumber(): number };
  limiteHmp: { toNumber(): number };
  updatedAt: Date;
};

@Injectable()
export class PrismaViviConfigRepository implements IViviConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(config: PrismaViviConfig): ViviConfigRecord {
    return {
      id: config.id,
      tenantId: config.tenantId,
      precoMinimo: config.precoMinimo.toNumber(),
      limiteSemPerfil: config.limiteSemPerfil.toNumber(),
      limiteHis1: config.limiteHis1.toNumber(),
      limiteHis2: config.limiteHis2.toNumber(),
      limiteHmp: config.limiteHmp.toNumber(),
      updatedAt: config.updatedAt,
    };
  }

  async findByTenantId(tenantId: string): Promise<ViviConfigRecord | null> {
    const config = await this.prisma.viviConfig.findUnique({ where: { tenantId } });
    return config ? this.toRecord(config) : null;
  }

  async create(tenantId: string): Promise<ViviConfigRecord> {
    const config = await this.prisma.viviConfig.create({ data: { tenantId } });
    return this.toRecord(config);
  }

  async update(
    tenantId: string,
    input: {
      precoMinimo: number;
      limiteSemPerfil: number;
      limiteHis1: number;
      limiteHis2: number;
      limiteHmp: number;
    },
  ): Promise<ViviConfigRecord> {
    const config = await this.prisma.viviConfig.update({
      where: { tenantId },
      data: input,
    });
    return this.toRecord(config);
  }
}
