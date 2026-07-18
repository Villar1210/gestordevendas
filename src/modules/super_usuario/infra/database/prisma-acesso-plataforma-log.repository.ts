// src/modules/super_usuario/infra/database/prisma-acesso-plataforma-log.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IAcessoPlataformaLogRepository,
  AcessoPlataformaLogRecord,
} from '../../domain/repositories/acesso-plataforma-log-repository.interface';

@Injectable()
export class PrismaAcessoPlataformaLogRepository implements IAcessoPlataformaLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    superUsuarioId: string;
    tenantId: string;
    tenantNome: string;
  }): Promise<AcessoPlataformaLogRecord> {
    return this.prisma.acessoPlataformaLog.create({
      data: {
        superUsuarioId: input.superUsuarioId,
        tenantId: input.tenantId,
        tenantNome: input.tenantNome,
      },
    });
  }
}
