// src/modules/bii/infra/database/prisma-concorrente.repository.ts
// BiiConcorrente - POR TENANT: todo where comeca por tenantId; escrita e
// remocao condicionais (updateMany/deleteMany where { id, tenantId }).
// So Prisma tipado (sem SQL bruto). Decimal -> number na saida.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ConcorrenteRegistro,
  DadosConcorrente,
  IConcorrenteRepository,
} from '../../domain/repositories/concorrente-repository.interface';
import type { BoundingBox } from '../../domain/services/geo';
import type { FaseConcorrente } from '../../domain/services/concorrente';

const SELECT = {
  id: true,
  nome: true,
  construtora: true,
  endereco: true,
  enderecoFormatado: true,
  latitude: true,
  longitude: true,
  precisao: true,
  fase: true,
  dataLancamento: true,
  totalUnidades: true,
  unidadesVendidas: true,
  fonte: true,
  fonteUrl: true,
  observacoes: true,
  origem: true,
  createdAt: true,
  updatedAt: true,
  tipologias: {
    orderBy: { ordem: 'asc' as const },
    select: { descricao: true, dormitorios: true, areaPrivativa: true, precoDe: true, precoAte: true },
  },
};

type Linha = {
  id: string;
  nome: string;
  construtora: string | null;
  endereco: string;
  enderecoFormatado: string | null;
  latitude: number;
  longitude: number;
  precisao: string;
  fase: string;
  dataLancamento: Date | null;
  totalUnidades: number | null;
  unidadesVendidas: number | null;
  fonte: string | null;
  fonteUrl: string | null;
  observacoes: string | null;
  origem: string;
  createdAt: Date;
  updatedAt: Date;
  tipologias: { descricao: string; dormitorios: number | null; areaPrivativa: unknown; precoDe: unknown; precoAte: unknown }[];
};

function paraRegistro(r: Linha): ConcorrenteRegistro {
  return {
    id: r.id,
    nome: r.nome,
    construtora: r.construtora,
    endereco: r.endereco,
    enderecoFormatado: r.enderecoFormatado,
    lat: r.latitude,
    lng: r.longitude,
    precisao: r.precisao,
    fase: r.fase as FaseConcorrente,
    dataLancamento: r.dataLancamento,
    totalUnidades: r.totalUnidades,
    unidadesVendidas: r.unidadesVendidas,
    fonte: r.fonte,
    fonteUrl: r.fonteUrl,
    observacoes: r.observacoes,
    origem: r.origem,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    tipologias: r.tipologias.map((t) => ({
      descricao: t.descricao,
      dormitorios: t.dormitorios,
      areaPrivativa: Number(t.areaPrivativa),
      precoDe: Number(t.precoDe),
      precoAte: t.precoAte === null || t.precoAte === undefined ? null : Number(t.precoAte),
    })),
  };
}

function colunas(d: DadosConcorrente) {
  return {
    nome: d.nome,
    construtora: d.construtora,
    endereco: d.endereco,
    enderecoFormatado: d.enderecoFormatado,
    latitude: d.lat,
    longitude: d.lng,
    precisao: d.precisao,
    fase: d.fase,
    dataLancamento: d.dataLancamento,
    totalUnidades: d.totalUnidades,
    unidadesVendidas: d.unidadesVendidas,
    fonte: d.fonte,
    fonteUrl: d.fonteUrl,
    observacoes: d.observacoes,
  };
}

function tipologiasParaCriar(d: DadosConcorrente) {
  return d.tipologias.map((t, i) => ({
    ordem: i + 1,
    descricao: t.descricao,
    dormitorios: t.dormitorios,
    areaPrivativa: t.areaPrivativa,
    precoDe: t.precoDe,
    precoAte: t.precoAte,
  }));
}

@Injectable()
export class PrismaConcorrenteRepository implements IConcorrenteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorTenant(tenantId: string, limite: number): Promise<ConcorrenteRegistro[]> {
    const rows = await this.prisma.biiConcorrente.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: limite,
      select: SELECT,
    });
    return rows.map(paraRegistro);
  }

  async buscarPorIdETenant(id: string, tenantId: string): Promise<ConcorrenteRegistro | null> {
    const r = await this.prisma.biiConcorrente.findFirst({ where: { tenantId, id }, select: SELECT });
    return r ? paraRegistro(r) : null;
  }

  async buscarNoBbox(tenantId: string, bbox: BoundingBox, limite: number): Promise<ConcorrenteRegistro[]> {
    const rows = await this.prisma.biiConcorrente.findMany({
      where: {
        tenantId,
        latitude: { gte: bbox.sul, lte: bbox.norte },
        longitude: { gte: bbox.oeste, lte: bbox.leste },
      },
      take: limite,
      select: SELECT,
    });
    return rows.map(paraRegistro);
  }

  async contarPorTenant(tenantId: string): Promise<number> {
    return this.prisma.biiConcorrente.count({ where: { tenantId } });
  }

  async criar(tenantId: string, userId: string, d: DadosConcorrente): Promise<ConcorrenteRegistro> {
    const r = await this.prisma.biiConcorrente.create({
      data: {
        tenantId,
        createdById: userId,
        updatedById: userId,
        ...colunas(d),
        tipologias: { create: tipologiasParaCriar(d) },
      },
      select: SELECT,
    });
    return paraRegistro(r);
  }

  async atualizar(id: string, tenantId: string, userId: string, d: DadosConcorrente): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // condicional: so toca se o concorrente for do tenant
      const { count } = await tx.biiConcorrente.updateMany({
        where: { tenantId, id },
        data: { ...colunas(d), updatedById: userId },
      });
      if (count === 0) return false;
      await tx.biiConcorrenteTipologia.deleteMany({ where: { concorrenteId: id } });
      await tx.biiConcorrenteTipologia.createMany({
        data: tipologiasParaCriar(d).map((t) => ({ ...t, concorrenteId: id })),
      });
      return true;
    });
  }

  async excluir(id: string, tenantId: string): Promise<boolean> {
    const { count } = await this.prisma.biiConcorrente.deleteMany({ where: { tenantId, id } });
    return count > 0;
  }
}
