// src/modules/bii/infra/database/prisma-itbi-importacao.repository.ts
// ItbiImportacao - GLOBAL (historico das importacoes do Super Usuario).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  AbaImportacao,
  IItbiImportacaoRepository,
  ItbiImportacaoRegistro,
  ProgressoImportacao,
  StatusImportacao,
} from '../../domain/repositories/itbi-importacao-repository.interface';

type Linha = {
  id: string;
  nomeArquivo: string;
  ano: number;
  status: string;
  linhasLidas: number;
  linhasInseridas: number;
  linhasDuplicadas: number;
  linhasDescartadas: number;
  abas: unknown;
  mensagemErro: string | null;
  importadoPorUserId: string;
  iniciadoEm: Date;
  atualizadoEm: Date;
  concluidoEm: Date | null;
};

const paraRegistro = (r: Linha): ItbiImportacaoRegistro => ({
  ...r,
  status: r.status as StatusImportacao,
  abas: Array.isArray(r.abas) ? (r.abas as AbaImportacao[]) : [],
});

const dadosProgresso = (p: ProgressoImportacao) => ({
  linhasLidas: p.linhasLidas,
  linhasInseridas: p.linhasInseridas,
  linhasDuplicadas: p.linhasDuplicadas,
  linhasDescartadas: p.linhasDescartadas,
  abas: p.abas.map((a) => ({ ...a })),
});

@Injectable()
export class PrismaItbiImportacaoRepository implements IItbiImportacaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async criar(d: { nomeArquivo: string; ano: number; importadoPorUserId: string }) {
    const r = await this.prisma.itbiImportacao.create({ data: { ...d, status: 'processando', abas: [] } });
    return paraRegistro(r);
  }

  async listarProcessando() {
    const rows = await this.prisma.itbiImportacao.findMany({ where: { status: 'processando' } });
    return rows.map(paraRegistro);
  }

  async atualizarProgresso(id: string, p: ProgressoImportacao) {
    await this.prisma.itbiImportacao.update({ where: { id }, data: dadosProgresso(p) });
  }

  async finalizar(id: string, status: 'concluida' | 'erro', p: ProgressoImportacao, mensagemErro: string | null) {
    await this.prisma.itbiImportacao.update({
      where: { id },
      data: { ...dadosProgresso(p), status, mensagemErro, concluidoEm: new Date() },
    });
  }

  async marcarAbandonada(id: string, mensagem: string) {
    await this.prisma.itbiImportacao.updateMany({
      where: { id, status: 'processando' },
      data: { status: 'erro', mensagemErro: mensagem, concluidoEm: new Date() },
    });
  }

  async marcarTodasProcessandoComoErro(mensagem: string): Promise<number> {
    const r = await this.prisma.itbiImportacao.updateMany({
      where: { status: 'processando' },
      data: { status: 'erro', mensagemErro: mensagem, concluidoEm: new Date() },
    });
    return r.count;
  }

  async listar(limite: number) {
    const rows = await this.prisma.itbiImportacao.findMany({ orderBy: { iniciadoEm: 'desc' }, take: limite });
    return rows.map(paraRegistro);
  }

  async anosConcluidos(): Promise<number[]> {
    const rows = await this.prisma.itbiImportacao.findMany({
      where: { status: 'concluida', linhasInseridas: { gt: 0 } },
      select: { ano: true },
      distinct: ['ano'],
      orderBy: { ano: 'asc' },
    });
    return rows.map((r) => r.ano);
  }

  async ultimaConcluida(): Promise<Date | null> {
    const r = await this.prisma.itbiImportacao.findFirst({
      where: { status: 'concluida' },
      orderBy: { concluidoEm: 'desc' },
      select: { concluidoEm: true },
    });
    return r?.concluidoEm ?? null;
  }
}
