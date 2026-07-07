// src/modules/gestao_imobiliaria/infra/database/prisma-imovel.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import {
  IImovelRepository,
  ImovelFilters,
  ImovelPhotoRecord,
  ImovelRecord,
} from '../../domain/repositories/imovel-repository.interface';

type PrismaImovelRow = {
  id: string;
  tenantId: string;
  empreendimentoId: string | null;
  title: string;
  tipo: string;
  finalidade: string;
  price: { toNumber(): number } | null;
  rentPrice: { toNumber(): number } | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  description: string | null;
  status: string;
  customFields: unknown;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaImovelRepository implements IImovelRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: PrismaImovelRow): ImovelRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      empreendimentoId: row.empreendimentoId,
      title: row.title,
      tipo: row.tipo,
      finalidade: row.finalidade,
      price: row.price ? row.price.toNumber() : null,
      rentPrice: row.rentPrice ? row.rentPrice.toNumber() : null,
      area: row.area,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      parkingSpots: row.parkingSpots,
      rua: row.rua,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      cidade: row.cidade,
      uf: row.uf,
      cep: row.cep,
      description: row.description,
      status: row.status,
      customFields: (row.customFields as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(input: {
    tenantId: string;
    empreendimentoId?: string | null;
    title: string;
    tipo: string;
    finalidade: string;
    price?: number | null;
    rentPrice?: number | null;
    area?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    parkingSpots?: number | null;
    rua?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    description?: string | null;
    status?: string;
    customFields?: Record<string, unknown>;
  }): Promise<ImovelRecord> {
    const row = await this.prisma.imovel.create({
      data: {
        tenantId: input.tenantId,
        empreendimentoId: input.empreendimentoId ?? null,
        title: input.title,
        tipo: input.tipo,
        finalidade: input.finalidade,
        price: input.price ?? null,
        rentPrice: input.rentPrice ?? null,
        area: input.area ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        parkingSpots: input.parkingSpots ?? null,
        rua: input.rua ?? null,
        numero: input.numero ?? null,
        complemento: input.complemento ?? null,
        bairro: input.bairro ?? null,
        cidade: input.cidade ?? null,
        uf: input.uf ?? null,
        cep: input.cep ?? null,
        description: input.description ?? null,
        status: input.status ?? 'disponivel',
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.toRecord(row);
  }

  async update(
    id: string,
    input: {
      empreendimentoId?: string | null;
      title?: string;
      tipo?: string;
      finalidade?: string;
      price?: number | null;
      rentPrice?: number | null;
      area?: number | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      parkingSpots?: number | null;
      rua?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cidade?: string | null;
      uf?: string | null;
      cep?: string | null;
      description?: string | null;
      status?: string;
      customFields?: Record<string, unknown>;
    },
  ): Promise<ImovelRecord> {
    const row = await this.prisma.imovel.update({
      where: { id },
      data: {
        ...(input.empreendimentoId !== undefined
          ? { empreendimentoId: input.empreendimentoId }
          : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
        ...(input.finalidade !== undefined ? { finalidade: input.finalidade } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.rentPrice !== undefined ? { rentPrice: input.rentPrice } : {}),
        ...(input.area !== undefined ? { area: input.area } : {}),
        ...(input.bedrooms !== undefined ? { bedrooms: input.bedrooms } : {}),
        ...(input.bathrooms !== undefined ? { bathrooms: input.bathrooms } : {}),
        ...(input.parkingSpots !== undefined ? { parkingSpots: input.parkingSpots } : {}),
        ...(input.rua !== undefined ? { rua: input.rua } : {}),
        ...(input.numero !== undefined ? { numero: input.numero } : {}),
        ...(input.complemento !== undefined ? { complemento: input.complemento } : {}),
        ...(input.bairro !== undefined ? { bairro: input.bairro } : {}),
        ...(input.cidade !== undefined ? { cidade: input.cidade } : {}),
        ...(input.uf !== undefined ? { uf: input.uf } : {}),
        ...(input.cep !== undefined ? { cep: input.cep } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.customFields !== undefined
          ? { customFields: input.customFields as Prisma.InputJsonValue }
          : {}),
      },
    });
    return this.toRecord(row);
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<ImovelRecord | null> {
    const row = await this.prisma.imovel.findFirst({ where: { id, tenantId } });
    return row ? this.toRecord(row) : null;
  }

  async findAllByTenant(tenantId: string, filters?: ImovelFilters): Promise<ImovelRecord[]> {
    const rows = await this.prisma.imovel.findMany({
      where: {
        tenantId,
        ...(filters?.finalidade ? { finalidade: filters.finalidade } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.empreendimentoId ? { empreendimentoId: filters.empreendimentoId } : {}),
        ...(filters?.busca
          ? { title: { contains: filters.busca, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findPhotosByImovel(imovelId: string): Promise<ImovelPhotoRecord[]> {
    return this.prisma.imovelPhoto.findMany({
      where: { imovelId },
      orderBy: { order: 'asc' },
    });
  }

  async addPhoto(input: {
    tenantId: string;
    imovelId: string;
    url: string;
    order: number;
  }): Promise<ImovelPhotoRecord> {
    return this.prisma.imovelPhoto.create({
      data: {
        tenantId: input.tenantId,
        imovelId: input.imovelId,
        url: input.url,
        order: input.order,
      },
    });
  }

  async findPhotoByIdAndTenant(
    photoId: string,
    tenantId: string,
  ): Promise<ImovelPhotoRecord | null> {
    return this.prisma.imovelPhoto.findFirst({ where: { id: photoId, tenantId } });
  }

  async deletePhoto(photoId: string): Promise<void> {
    await this.prisma.imovelPhoto.delete({ where: { id: photoId } });
  }
}
