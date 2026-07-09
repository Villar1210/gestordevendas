// src/modules/gestao_imobiliaria/infra/database/prisma-contrato.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ContratoFilters,
  ContratoRecord,
  IContratoRepository,
} from '../../domain/repositories/contrato-repository.interface';

type PrismaContratoRow = {
  id: string;
  tenantId: string;
  imovelId: string;
  proprietarioId: string;
  inquilinoCompradorId: string;
  tipo: string;
  valor: { toNumber(): number };
  dataInicio: Date;
  dataFim: Date | null;
  diaVencimento: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaContratoRepository implements IContratoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: PrismaContratoRow): ContratoRecord {
    return { ...row, valor: row.valor.toNumber() };
  }

  async create(input: {
    tenantId: string;
    imovelId: string;
    proprietarioId: string;
    inquilinoCompradorId: string;
    tipo: string;
    valor: number;
    dataInicio: Date;
    dataFim?: Date | null;
    diaVencimento?: number | null;
  }): Promise<ContratoRecord> {
    const row = await this.prisma.contrato.create({ data: input });
    return this.toRecord(row);
  }

  async updateStatus(id: string, status: string): Promise<ContratoRecord> {
    const row = await this.prisma.contrato.update({ where: { id }, data: { status } });
    return this.toRecord(row);
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<ContratoRecord | null> {
    const row = await this.prisma.contrato.findFirst({ where: { id, tenantId } });
    return row ? this.toRecord(row) : null;
  }

  async findAllByTenant(tenantId: string, filters?: ContratoFilters): Promise<ContratoRecord[]> {
    const rows = await this.prisma.contrato.findMany({
      where: {
        tenantId,
        ...(filters?.tipo ? { tipo: filters.tipo } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.imovelId ? { imovelId: filters.imovelId } : {}),
        ...(filters?.proprietarioId ? { proprietarioId: filters.proprietarioId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }
}
