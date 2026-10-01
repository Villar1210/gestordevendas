// src/modules/rh/infra/database/prisma-contrato-parceria-config.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ContratoParceriaConfigDados,
  IContratoParceriaConfigRepository,
} from '../../domain/repositories/contrato-parceria-config-repository.interface';

const CAMPOS = {
  assinaturaEmpresaAtiva: true,
  representanteNome: true,
  representanteEmail: true,
  representanteCargo: true,
  quantidadeTestemunhas: true,
  testemunha1Nome: true,
  testemunha1Email: true,
  testemunha2Nome: true,
  testemunha2Email: true,
  bloquearAcessoAteAssinar: true,
  lembretesAtivos: true,
  lembreteDias: true,
} as const;

@Injectable()
export class PrismaContratoParceriaConfigRepository implements IContratoParceriaConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTenantId(tenantId: string): Promise<ContratoParceriaConfigDados | null> {
    return this.prisma.contratoParceriaConfig.findUnique({ where: { tenantId }, select: CAMPOS });
  }

  upsert(tenantId: string, dados: ContratoParceriaConfigDados): Promise<ContratoParceriaConfigDados> {
    return this.prisma.contratoParceriaConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...dados },
      update: dados,
      select: CAMPOS,
    });
  }
}
