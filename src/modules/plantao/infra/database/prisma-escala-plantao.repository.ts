// src/modules/plantao/infra/database/prisma-escala-plantao.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IEscalaPlantaoRepository,
  EscalaPlantaoRecord,
  EscalaPlantaoWithUserName,
} from '../../domain/repositories/escala-plantao-repository.interface';

@Injectable()
export class PrismaEscalaPlantaoRepository implements IEscalaPlantaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStandUserDia(
    standId: string,
    userId: string,
    diaSemana: number,
  ): Promise<EscalaPlantaoRecord | null> {
    return this.prisma.escalaPlantao.findUnique({
      where: { standId_userId_diaSemana: { standId, userId, diaSemana } },
    });
  }

  async create(input: {
    tenantId: string;
    standId: string;
    userId: string;
    diaSemana: number;
  }): Promise<EscalaPlantaoRecord> {
    return this.prisma.escalaPlantao.create({
      data: {
        tenantId: input.tenantId,
        standId: input.standId,
        userId: input.userId,
        diaSemana: input.diaSemana,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.escalaPlantao.delete({ where: { id } });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<EscalaPlantaoRecord | null> {
    return this.prisma.escalaPlantao.findFirst({ where: { id, tenantId } });
  }

  async findAllByStand(standId: string): Promise<EscalaPlantaoWithUserName[]> {
    const rows = await this.prisma.escalaPlantao.findMany({
      where: { standId },
      include: { user: { select: { name: true } } },
      orderBy: { diaSemana: 'asc' },
    });
    return rows.map(({ user, ...row }) => ({ ...row, userName: user.name }));
  }
}
