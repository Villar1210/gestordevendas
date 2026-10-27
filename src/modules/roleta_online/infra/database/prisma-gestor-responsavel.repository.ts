// src/modules/roleta_online/infra/database/prisma-gestor-responsavel.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  GestorResponsavel,
  IGestorResponsavelRepository,
} from '../../domain/repositories/gestor-responsavel-repository.interface';

const ADMINISTRADOR_ROLE_NAME = 'Administrador';

@Injectable()
export class PrismaGestorResponsavelRepository implements IGestorResponsavelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async encontrarParaCorretor(tenantId: string, corretorId: string | null): Promise<GestorResponsavel | null> {
    if (corretorId) {
      const corretor = await this.prisma.user.findFirst({
        where: { id: corretorId, tenantId },
        select: { superior: { select: { id: true, name: true, tenantId: true, statusCadastro: true } } },
      });
      const superior = corretor?.superior;
      if (superior && superior.tenantId === tenantId && superior.statusCadastro === 'aprovado') {
        return { id: superior.id, name: superior.name };
      }
    }

    const admin = await this.prisma.user.findFirst({
      where: { tenantId, role: { name: ADMINISTRADOR_ROLE_NAME } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    return admin ?? null;
  }
}
