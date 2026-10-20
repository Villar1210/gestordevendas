// src/modules/bii/infra/database/prisma-bii-analise.repository.ts
// BiiAnalise - POR TENANT: toda leitura filtra tenantId.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  BiiAnaliseCompleta,
  BiiAnaliseResumo,
  IBiiAnaliseRepository,
  NovaBiiAnalise,
} from '../../domain/repositories/bii-analise-repository.interface';

@Injectable()
export class PrismaBiiAnaliseRepository implements IBiiAnaliseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async criar(d: NovaBiiAnalise) {
    const r = await this.prisma.biiAnalise.create({
      data: {
        tenantId: d.tenantId,
        createdById: d.createdById,
        impersonadoPor: d.impersonadoPor,
        enderecoDigitado: d.enderecoDigitado,
        enderecoFormatado: d.enderecoFormatado,
        latitude: d.lat,
        longitude: d.lng,
        precisao: d.precisao,
        raioMetros: d.raioMetros,
        meses: d.meses,
        areaMin: d.areaMin,
        areaMax: d.areaMax,
        transacoes: d.transacoes,
        precoM2Mediano: d.precoM2Mediano,
        resultado: d.resultado as object,
      },
      select: { id: true, createdAt: true },
    });
    return r;
  }

  async listarPorTenant(tenantId: string, limite: number): Promise<BiiAnaliseResumo[]> {
    const rows = await this.prisma.biiAnalise.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        enderecoDigitado: true,
        enderecoFormatado: true,
        raioMetros: true,
        meses: true,
        transacoes: true,
        precoM2Mediano: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({ ...r, precoM2Mediano: r.precoM2Mediano === null ? null : Number(r.precoM2Mediano) }));
  }

  async buscarPorIdETenant(id: string, tenantId: string): Promise<BiiAnaliseCompleta | null> {
    const r = await this.prisma.biiAnalise.findFirst({
      where: { id, tenantId },
      select: { id: true, resultado: true, createdAt: true },
    });
    if (!r) return null;
    return { id: r.id, resultado: (r.resultado ?? {}) as Record<string, unknown>, createdAt: r.createdAt };
  }

  async contarDesde(tenantId: string, desde: Date): Promise<number> {
    return this.prisma.biiAnalise.count({ where: { tenantId, createdAt: { gte: desde } } });
  }
}
