// src/modules/roleta_online/infra/database/prisma-roleta-config.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IRoletaConfigRepository,
  RoletaConfigRecord,
} from '../../domain/repositories/roleta-config-repository.interface';

@Injectable()
export class PrismaRoletaConfigRepository implements IRoletaConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<RoletaConfigRecord | null> {
    return this.prisma.roletaConfig.findUnique({ where: { tenantId } });
  }

  async upsert(input: {
    tenantId: string;
    algoritmo?: string;
    modo?: string;
    ativa?: boolean;
    timeoutAceiteMinutos?: number;
  }): Promise<RoletaConfigRecord> {
    return this.prisma.roletaConfig.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        algoritmo: input.algoritmo,
        modo: input.modo,
        ativa: input.ativa,
        timeoutAceiteMinutos: input.timeoutAceiteMinutos,
      },
      update: {
        algoritmo: input.algoritmo,
        modo: input.modo,
        ativa: input.ativa,
        timeoutAceiteMinutos: input.timeoutAceiteMinutos,
      },
    });
  }

  async updateUltimoCorretor(tenantId: string, corretorId: string): Promise<void> {
    await this.prisma.roletaConfig.update({
      where: { tenantId },
      data: { ultimoCorretorId: corretorId },
    });
  }
}
