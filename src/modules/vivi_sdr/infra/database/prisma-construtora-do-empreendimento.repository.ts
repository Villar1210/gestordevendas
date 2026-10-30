// src/modules/vivi_sdr/infra/database/prisma-construtora-do-empreendimento.repository.ts
// Camada de INFRA: construtora vinculada ao empreendimento da conversa da
// VIVI (Construtoras, Fatia B). Sempre filtrado por tenantId (o do
// empreendimento E o da construtora).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ConstrutoraDoEmpreendimento,
  IConstrutoraDoEmpreendimentoRepository,
} from '../../domain/repositories/construtora-do-empreendimento-repository.interface';

@Injectable()
export class PrismaConstrutoraDoEmpreendimentoRepository implements IConstrutoraDoEmpreendimentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorEmpreendimento(tenantId: string, empreendimentoId: string): Promise<ConstrutoraDoEmpreendimento | null> {
    const empreendimento = await this.prisma.empreendimento.findFirst({
      where: { id: empreendimentoId, tenantId },
      select: { construtoraVinculada: { select: { tenantId: true, nome: true, sobre: true, diferenciais: true } } },
    });
    const construtora = empreendimento?.construtoraVinculada;
    if (!construtora || construtora.tenantId !== tenantId) return null;
    return { nome: construtora.nome, sobre: construtora.sobre, diferenciais: construtora.diferenciais };
  }
}
