// src/modules/gestao_imobiliaria/infra/database/prisma-empreendimento.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
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

  async findAllByTenant(tenantId: string): Promise<EmpreendimentoRecord[]> {
    return this.prisma.empreendimento.findMany({
      where: { tenantId },
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
}
