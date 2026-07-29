// src/modules/vivi_sdr/infra/database/prisma-vivi-config.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IViviConfigRepository,
  ViviConfigRecord,
  UpdateViviConfigInput,
} from '../../domain/repositories/vivi-config-repository.interface';

type DecimalLike = { toNumber(): number } | null;

type PrismaViviConfig = {
  id: string;
  tenantId: string;
  precoMinimo: { toNumber(): number };
  limiteSemPerfil: { toNumber(): number };
  limiteFaixa1: { toNumber(): number };
  limiteFaixa2: { toNumber(): number };
  limiteFaixa3: { toNumber(): number };
  limiteFaixa4: { toNumber(): number };
  faixa1SubsidioMax: DecimalLike;
  faixa1JurosMin: DecimalLike;
  faixa1JurosMax: DecimalLike;
  faixa1TetoFinanciamento: string | null;
  faixa1ExemploParcela: string | null;
  faixa2SubsidioMax: DecimalLike;
  faixa2JurosMin: DecimalLike;
  faixa2JurosMax: DecimalLike;
  faixa2TetoFinanciamento: string | null;
  faixa2ExemploParcela: string | null;
  faixa3SubsidioMax: DecimalLike;
  faixa3JurosMin: DecimalLike;
  faixa3JurosMax: DecimalLike;
  faixa3TetoFinanciamento: string | null;
  faixa3ExemploParcela: string | null;
  faixa4SubsidioMax: DecimalLike;
  faixa4JurosMin: DecimalLike;
  faixa4JurosMax: DecimalLike;
  faixa4TetoFinanciamento: string | null;
  faixa4ExemploParcela: string | null;
  diasParaRotting: number;
  ativaRotatingIndicador: boolean;
  updatedAt: Date;
};

function toNumberOrNull(value: DecimalLike): number | null {
  return value ? value.toNumber() : null;
}

@Injectable()
export class PrismaViviConfigRepository implements IViviConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(config: PrismaViviConfig): ViviConfigRecord {
    return {
      id: config.id,
      tenantId: config.tenantId,
      precoMinimo: config.precoMinimo.toNumber(),
      limiteSemPerfil: config.limiteSemPerfil.toNumber(),
      limiteFaixa1: config.limiteFaixa1.toNumber(),
      limiteFaixa2: config.limiteFaixa2.toNumber(),
      limiteFaixa3: config.limiteFaixa3.toNumber(),
      limiteFaixa4: config.limiteFaixa4.toNumber(),
      faixa1SubsidioMax: toNumberOrNull(config.faixa1SubsidioMax),
      faixa1JurosMin: toNumberOrNull(config.faixa1JurosMin),
      faixa1JurosMax: toNumberOrNull(config.faixa1JurosMax),
      faixa1TetoFinanciamento: config.faixa1TetoFinanciamento,
      faixa1ExemploParcela: config.faixa1ExemploParcela,
      faixa2SubsidioMax: toNumberOrNull(config.faixa2SubsidioMax),
      faixa2JurosMin: toNumberOrNull(config.faixa2JurosMin),
      faixa2JurosMax: toNumberOrNull(config.faixa2JurosMax),
      faixa2TetoFinanciamento: config.faixa2TetoFinanciamento,
      faixa2ExemploParcela: config.faixa2ExemploParcela,
      faixa3SubsidioMax: toNumberOrNull(config.faixa3SubsidioMax),
      faixa3JurosMin: toNumberOrNull(config.faixa3JurosMin),
      faixa3JurosMax: toNumberOrNull(config.faixa3JurosMax),
      faixa3TetoFinanciamento: config.faixa3TetoFinanciamento,
      faixa3ExemploParcela: config.faixa3ExemploParcela,
      faixa4SubsidioMax: toNumberOrNull(config.faixa4SubsidioMax),
      faixa4JurosMin: toNumberOrNull(config.faixa4JurosMin),
      faixa4JurosMax: toNumberOrNull(config.faixa4JurosMax),
      faixa4TetoFinanciamento: config.faixa4TetoFinanciamento,
      faixa4ExemploParcela: config.faixa4ExemploParcela,
      diasParaRotting: config.diasParaRotting,
      ativaRotatingIndicador: config.ativaRotatingIndicador,
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

  async update(tenantId: string, input: UpdateViviConfigInput): Promise<ViviConfigRecord> {
    const config = await this.prisma.viviConfig.update({
      where: { tenantId },
      data: input,
    });
    return this.toRecord(config);
  }
}
