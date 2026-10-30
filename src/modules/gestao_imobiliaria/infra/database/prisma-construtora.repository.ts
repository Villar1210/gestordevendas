// src/modules/gestao_imobiliaria/infra/database/prisma-construtora.repository.ts
// Camada de INFRA: cadastro de Construtoras sobre o Prisma. Todo where leva
// tenantId (escrita por updateMany/deleteMany condicionais, nunca so por id).
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../config/prisma.service';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';
import {
  AtualizarConstrutoraDados,
  ConstrutoraRecord,
  CriarConstrutoraDados,
  IConstrutoraRepository,
} from '../../domain/repositories/construtora-repository.interface';

function traduzirUnico(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new UniqueConstraintViolationError('Ja existe uma construtora com esse nome normalizado no tenant.');
  }
  throw error;
}

@Injectable()
export class PrismaConstrutoraRepository implements IConstrutoraRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dados: CriarConstrutoraDados): Promise<ConstrutoraRecord> {
    try {
      return await this.prisma.construtora.create({
        data: {
          tenantId: dados.tenantId,
          nome: dados.nome,
          nomeNormalizado: dados.nomeNormalizado,
          site: dados.site ?? null,
          sobre: dados.sobre ?? null,
          diferenciais: dados.diferenciais ?? null,
        },
      });
    } catch (error) {
      traduzirUnico(error);
    }
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<ConstrutoraRecord | null> {
    const registro = await this.prisma.construtora.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { empreendimentos: true } } },
    });
    if (!registro) return null;
    const { _count, ...construtora } = registro;
    return { ...construtora, quantidadeEmpreendimentos: _count.empreendimentos };
  }

  async findByNomeNormalizado(tenantId: string, nomeNormalizado: string): Promise<ConstrutoraRecord | null> {
    return this.prisma.construtora.findFirst({ where: { tenantId, nomeNormalizado } });
  }

  async findAllByTenant(tenantId: string): Promise<ConstrutoraRecord[]> {
    const lista = await this.prisma.construtora.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { empreendimentos: true } } },
    });
    return lista.map(({ _count, ...construtora }) => ({
      ...construtora,
      quantidadeEmpreendimentos: _count.empreendimentos,
    }));
  }

  async update(id: string, tenantId: string, dados: AtualizarConstrutoraDados): Promise<ConstrutoraRecord | null> {
    const data: Prisma.ConstrutoraUpdateManyMutationInput = {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.nomeNormalizado !== undefined ? { nomeNormalizado: dados.nomeNormalizado } : {}),
      ...(dados.site !== undefined ? { site: dados.site } : {}),
      ...(dados.sobre !== undefined ? { sobre: dados.sobre } : {}),
      ...(dados.diferenciais !== undefined ? { diferenciais: dados.diferenciais } : {}),
      ...(dados.logoUrl !== undefined ? { logoUrl: dados.logoUrl } : {}),
    };
    try {
      const alterados = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.construtora.updateMany({ where: { id, tenantId }, data });
        // Texto legado do empreendimento acompanha o nome do cadastro.
        if (count > 0 && dados.nome !== undefined) {
          await tx.empreendimento.updateMany({
            where: { tenantId, construtoraId: id },
            data: { construtora: dados.nome },
          });
        }
        return count;
      });
      if (alterados === 0) return null;
    } catch (error) {
      traduzirUnico(error);
    }
    return this.findByIdAndTenant(id, tenantId);
  }

  async countEmpreendimentos(id: string, tenantId: string): Promise<number> {
    return this.prisma.empreendimento.count({ where: { tenantId, construtoraId: id } });
  }

  async deleteSemVinculo(id: string, tenantId: string): Promise<{ vinculados: number } | null> {
    return this.prisma.$transaction(async (tx) => {
      const existe = await tx.construtora.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!existe) return null;
      const vinculados = await tx.empreendimento.count({ where: { tenantId, construtoraId: id } });
      if (vinculados > 0) return { vinculados };
      await tx.construtora.deleteMany({ where: { id, tenantId } });
      return { vinculados: 0 };
    });
  }
}
