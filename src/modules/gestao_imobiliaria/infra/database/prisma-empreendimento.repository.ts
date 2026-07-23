// src/modules/gestao_imobiliaria/infra/database/prisma-empreendimento.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  EmpreendimentoPhotoRecord,
  EmpreendimentoRecord,
  FichaTecnicaPatch,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';

@Injectable()
export class PrismaEmpreendimentoRepository implements IEmpreendimentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    name: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    description?: string | null;
  }): Promise<EmpreendimentoRecord> {
    return this.prisma.empreendimento.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        rua: input.rua,
        numero: input.numero,
        bairro: input.bairro,
        cidade: input.cidade,
        uf: input.uf,
        cep: input.cep,
        description: input.description ?? null,
      },
    });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<EmpreendimentoRecord | null> {
    return this.prisma.empreendimento.findFirst({ where: { id, tenantId } });
  }

  async findAllByTenant(
    tenantId: string,
    filters?: { publicado?: boolean },
  ): Promise<EmpreendimentoRecord[]> {
    return this.prisma.empreendimento.findMany({
      where: {
        tenantId,
        ...(filters?.publicado !== undefined ? { publicado: filters.publicado } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    patch: { publicado?: boolean; origemImportacao?: string | null },
  ): Promise<EmpreendimentoRecord> {
    return this.prisma.empreendimento.update({
      where: { id },
      data: {
        ...(patch.publicado !== undefined ? { publicado: patch.publicado } : {}),
        ...(patch.origemImportacao !== undefined
          ? { origemImportacao: patch.origemImportacao }
          : {}),
      },
    });
  }

  async updateFichaTecnica(id: string, patch: FichaTecnicaPatch): Promise<EmpreendimentoRecord> {
    return this.prisma.empreendimento.update({
      where: { id },
      data: {
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.areaTerreno !== undefined ? { areaTerreno: patch.areaTerreno } : {}),
        ...(patch.totalUnidades !== undefined ? { totalUnidades: patch.totalUnidades } : {}),
        ...(patch.numeroTorres !== undefined ? { numeroTorres: patch.numeroTorres } : {}),
        ...(patch.unidadesPorAndar !== undefined
          ? { unidadesPorAndar: patch.unidadesPorAndar }
          : {}),
        ...(patch.gabarito !== undefined ? { gabarito: patch.gabarito } : {}),
        ...(patch.vagas !== undefined ? { vagas: patch.vagas } : {}),
        ...(patch.itensLazer !== undefined ? { itensLazer: patch.itensLazer } : {}),
        ...(patch.origemImportacao !== undefined
          ? { origemImportacao: patch.origemImportacao }
          : {}),
      },
    });
  }

  async findPhotosByEmpreendimento(empreendimentoId: string): Promise<EmpreendimentoPhotoRecord[]> {
    return this.prisma.empreendimentoPhoto.findMany({
      where: { empreendimentoId },
      orderBy: { order: 'asc' },
    });
  }

  async findPhotosByEmpreendimentoAndCategoria(
    empreendimentoId: string,
    categoria: string,
  ): Promise<EmpreendimentoPhotoRecord[]> {
    return this.prisma.empreendimentoPhoto.findMany({
      where: { empreendimentoId, categoria },
      orderBy: { order: 'asc' },
    });
  }

  async addPhoto(input: {
    tenantId: string;
    empreendimentoId: string;
    categoria: string;
    url: string;
    order: number;
  }): Promise<EmpreendimentoPhotoRecord> {
    return this.prisma.empreendimentoPhoto.create({
      data: {
        tenantId: input.tenantId,
        empreendimentoId: input.empreendimentoId,
        categoria: input.categoria,
        url: input.url,
        order: input.order,
      },
    });
  }

  async findPhotoByIdAndTenant(
    photoId: string,
    tenantId: string,
  ): Promise<EmpreendimentoPhotoRecord | null> {
    return this.prisma.empreendimentoPhoto.findFirst({ where: { id: photoId, tenantId } });
  }

  async deletePhoto(photoId: string): Promise<void> {
    await this.prisma.empreendimentoPhoto.delete({ where: { id: photoId } });
  }

  async reorderPhotos(
    empreendimentoId: string,
    categoria: string,
    orders: { id: string; order: number }[],
  ): Promise<EmpreendimentoPhotoRecord[]> {
    await this.prisma.$transaction(
      orders.map(({ id, order }) =>
        this.prisma.empreendimentoPhoto.update({ where: { id }, data: { order } }),
      ),
    );
    return this.findPhotosByEmpreendimentoAndCategoria(empreendimentoId, categoria);
  }
}
