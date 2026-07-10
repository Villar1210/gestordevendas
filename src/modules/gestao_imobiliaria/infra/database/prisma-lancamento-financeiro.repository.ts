// src/modules/gestao_imobiliaria/infra/database/prisma-lancamento-financeiro.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ILancamentoFinanceiroRepository,
  LancamentoFinanceiroFilters,
  LancamentoFinanceiroRecord,
} from '../../domain/repositories/lancamento-financeiro-repository.interface';

type PrismaLancamentoRow = {
  id: string;
  tenantId: string;
  contratoId: string | null;
  tipo: string;
  categoria: string;
  valor: { toNumber(): number };
  vencimento: Date;
  status: string;
  pagoEm: Date | null;
  descricao: string | null;
  createdAt: Date;
};

@Injectable()
export class PrismaLancamentoFinanceiroRepository implements ILancamentoFinanceiroRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: PrismaLancamentoRow): LancamentoFinanceiroRecord {
    return { ...row, valor: row.valor.toNumber() };
  }

  async create(input: {
    tenantId: string;
    contratoId?: string | null;
    tipo: string;
    categoria: string;
    valor: number;
    vencimento: Date;
    descricao?: string | null;
  }): Promise<LancamentoFinanceiroRecord> {
    const row = await this.prisma.lancamentoFinanceiro.create({
      data: {
        tenantId: input.tenantId,
        contratoId: input.contratoId ?? null,
        tipo: input.tipo,
        categoria: input.categoria,
        valor: input.valor,
        vencimento: input.vencimento,
        descricao: input.descricao ?? null,
      },
    });
    return this.toRecord(row);
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<LancamentoFinanceiroRecord | null> {
    const row = await this.prisma.lancamentoFinanceiro.findFirst({ where: { id, tenantId } });
    return row ? this.toRecord(row) : null;
  }

  async findAllByTenant(
    tenantId: string,
    filters?: LancamentoFinanceiroFilters,
  ): Promise<LancamentoFinanceiroRecord[]> {
    const rows = await this.prisma.lancamentoFinanceiro.findMany({
      where: {
        tenantId,
        ...(filters?.tipo ? { tipo: filters.tipo } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.contratoId ? { contratoId: filters.contratoId } : {}),
        ...(filters?.vencimentoDe || filters?.vencimentoAte
          ? {
              vencimento: {
                ...(filters?.vencimentoDe ? { gte: filters.vencimentoDe } : {}),
                ...(filters?.vencimentoAte ? { lte: filters.vencimentoAte } : {}),
              },
            }
          : {}),
      },
      orderBy: { vencimento: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async markAsPago(id: string, pagoEm: Date): Promise<LancamentoFinanceiroRecord> {
    const row = await this.prisma.lancamentoFinanceiro.update({
      where: { id },
      data: { status: 'pago', pagoEm },
    });
    return this.toRecord(row);
  }

  async existsForContratoAndPeriodo(input: {
    contratoId: string;
    tipo: string;
    categoria: string;
    vencimentoDe: Date;
    vencimentoAte: Date;
  }): Promise<boolean> {
    const count = await this.prisma.lancamentoFinanceiro.count({
      where: {
        contratoId: input.contratoId,
        tipo: input.tipo,
        categoria: input.categoria,
        vencimento: { gte: input.vencimentoDe, lte: input.vencimentoAte },
      },
    });
    return count > 0;
  }

  async updateManyStatusToAtrasado(tenantId: string, vencimentoAntesDe: Date): Promise<number> {
    const result = await this.prisma.lancamentoFinanceiro.updateMany({
      where: { tenantId, status: 'pendente', vencimento: { lt: vencimentoAntesDe } },
      data: { status: 'atrasado' },
    });
    return result.count;
  }
}
