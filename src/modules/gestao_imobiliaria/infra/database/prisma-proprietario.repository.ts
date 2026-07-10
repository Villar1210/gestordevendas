// src/modules/gestao_imobiliaria/infra/database/prisma-proprietario.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IProprietarioRepository,
  ProprietarioRecord,
  ProprietarioWritableFields,
} from '../../domain/repositories/proprietario-repository.interface';

@Injectable()
export class PrismaProprietarioRepository implements IProprietarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: ProprietarioWritableFields & { tenantId: string; nome: string; telefone: string },
  ): Promise<ProprietarioRecord> {
    return this.prisma.proprietario.create({ data: input });
  }

  async update(id: string, input: ProprietarioWritableFields): Promise<ProprietarioRecord> {
    return this.prisma.proprietario.update({ where: { id }, data: input });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<ProprietarioRecord | null> {
    return this.prisma.proprietario.findFirst({ where: { id, tenantId } });
  }

  async findByTenantAndEmail(tenantId: string, email: string): Promise<ProprietarioRecord | null> {
    return this.prisma.proprietario.findFirst({ where: { tenantId, email } });
  }

  async findAllByTenant(tenantId: string): Promise<ProprietarioRecord[]> {
    const proprietarios = await this.prisma.proprietario.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
    });

    // Conta imoveis distintos vinculados a cada proprietario via Contrato,
    // numa unica consulta (evita N+1).
    const contratos = await this.prisma.contrato.findMany({
      where: { tenantId },
      select: { proprietarioId: true, imovelId: true },
    });
    const imoveisPorProprietario = new Map<string, Set<string>>();
    for (const contrato of contratos) {
      const set = imoveisPorProprietario.get(contrato.proprietarioId) ?? new Set<string>();
      set.add(contrato.imovelId);
      imoveisPorProprietario.set(contrato.proprietarioId, set);
    }

    return proprietarios.map((proprietario) => ({
      ...proprietario,
      imoveisVinculados: imoveisPorProprietario.get(proprietario.id)?.size ?? 0,
    }));
  }
}
