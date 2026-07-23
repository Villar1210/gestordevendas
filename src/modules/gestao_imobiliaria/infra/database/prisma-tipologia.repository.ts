// src/modules/gestao_imobiliaria/infra/database/prisma-tipologia.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ITipologiaRepository,
  TipologiaInput,
  TipologiaRecord,
} from '../../domain/repositories/tipologia-repository.interface';

@Injectable()
export class PrismaTipologiaRepository implements ITipologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByEmpreendimento(
    tenantId: string,
    empreendimentoId: string,
  ): Promise<TipologiaRecord[]> {
    return this.prisma.tipologia.findMany({
      where: { tenantId, empreendimentoId },
      orderBy: { nome: 'asc' },
    });
  }

  async replaceAllForEmpreendimento(
    tenantId: string,
    empreendimentoId: string,
    tipologias: TipologiaInput[],
  ): Promise<TipologiaRecord[]> {
    await this.prisma.$transaction([
      this.prisma.tipologia.deleteMany({ where: { tenantId, empreendimentoId } }),
      this.prisma.tipologia.createMany({
        data: tipologias.map((tipologia) => ({
          tenantId,
          empreendimentoId,
          nome: tipologia.nome,
          areaPrivativa: tipologia.areaPrivativa,
          dormitorios: tipologia.dormitorios,
        })),
      }),
    ]);

    return this.findAllByEmpreendimento(tenantId, empreendimentoId);
  }
}
