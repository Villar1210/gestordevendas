// src/modules/bii/infra/database/prisma-estudo.repository.ts
// BiiEstudo - POR TENANT: todo where comeca por tenantId; escrita e remocao
// condicionais (updateMany/deleteMany where { tenantId, id }). So Prisma tipado.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  EstudoCompleto,
  EstudoResumo,
  IEstudoRepository,
  NovoEstudo,
  SituacaoResumo,
} from '../../domain/repositories/estudo-repository.interface';

const SELECT_RESUMO = {
  id: true,
  nome: true,
  enderecoFormatado: true,
  raioMetros: true,
  meses: true,
  situacaoResumo: true,
  createdAt: true,
  updatedAt: true,
};
const SELECT_COMPLETO = { ...SELECT_RESUMO, analiseId: true, conclusao: true, resultado: true };

type LinhaResumo = Omit<EstudoResumo, 'situacaoResumo'> & { situacaoResumo: unknown };
type LinhaCompleta = LinhaResumo & { analiseId: string | null; conclusao: string | null; resultado: unknown };

function situacao(v: unknown): SituacaoResumo {
  const o = (v ?? {}) as Partial<SituacaoResumo>;
  return { ok: Number(o.ok) || 0, atencao: Number(o.atencao) || 0, fora: Number(o.fora) || 0 };
}
const paraResumo = (r: LinhaResumo): EstudoResumo => ({ ...r, situacaoResumo: situacao(r.situacaoResumo) });
const paraCompleto = (r: LinhaCompleta): EstudoCompleto => ({
  ...paraResumo(r),
  analiseId: r.analiseId,
  conclusao: r.conclusao,
  resultado: (r.resultado ?? {}) as Record<string, unknown>,
});

@Injectable()
export class PrismaEstudoRepository implements IEstudoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async criar(d: NovoEstudo): Promise<EstudoCompleto> {
    const r = await this.prisma.biiEstudo.create({
      data: {
        tenantId: d.tenantId,
        analiseId: d.analiseId,
        nome: d.nome,
        enderecoFormatado: d.enderecoFormatado.slice(0, 500),
        raioMetros: d.raioMetros,
        meses: d.meses,
        tipologias: d.tipologias as object[],
        premissas: d.premissas as object,
        conclusao: d.conclusao,
        situacaoResumo: d.situacaoResumo as unknown as object,
        resultado: d.resultado as object,
        createdById: d.userId,
        updatedById: d.userId,
      },
      select: SELECT_COMPLETO,
    });
    return paraCompleto(r);
  }

  async listarPorTenant(tenantId: string, limite: number): Promise<EstudoResumo[]> {
    const rows = await this.prisma.biiEstudo.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: limite,
      select: SELECT_RESUMO,
    });
    return rows.map(paraResumo);
  }

  async buscarPorIdETenant(id: string, tenantId: string): Promise<EstudoCompleto | null> {
    const r = await this.prisma.biiEstudo.findFirst({ where: { tenantId, id }, select: SELECT_COMPLETO });
    return r ? paraCompleto(r) : null;
  }

  async contarPorTenant(tenantId: string): Promise<number> {
    return this.prisma.biiEstudo.count({ where: { tenantId } });
  }

  async atualizarTextos(id: string, tenantId: string, userId: string, d: { nome?: string; conclusao?: string | null }): Promise<boolean> {
    const data: { nome?: string; conclusao?: string | null; updatedById: string } = { updatedById: userId };
    if (d.nome !== undefined) data.nome = d.nome;
    if (d.conclusao !== undefined) data.conclusao = d.conclusao;
    const { count } = await this.prisma.biiEstudo.updateMany({ where: { tenantId, id }, data });
    return count > 0;
  }

  async excluir(id: string, tenantId: string): Promise<boolean> {
    const { count } = await this.prisma.biiEstudo.deleteMany({ where: { tenantId, id } });
    return count > 0;
  }
}
