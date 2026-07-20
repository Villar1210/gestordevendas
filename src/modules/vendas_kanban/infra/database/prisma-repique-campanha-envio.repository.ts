// src/modules/vendas_kanban/infra/database/prisma-repique-campanha-envio.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IRepiqueCampanhaEnvioRepository,
  RepiqueCampanhaEnvioRecord,
} from '../../domain/repositories/repique-campanha-envio-repository.interface';

@Injectable()
export class PrismaRepiqueCampanhaEnvioRepository implements IRepiqueCampanhaEnvioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    cardId: string;
    canal: string;
    motivoRepiqueNoEnvio?: string | null;
    sucesso: boolean;
    erroMensagem?: string | null;
  }): Promise<RepiqueCampanhaEnvioRecord> {
    return this.prisma.repiqueCampanhaEnvio.create({
      data: {
        tenantId: input.tenantId,
        cardId: input.cardId,
        canal: input.canal,
        motivoRepiqueNoEnvio: input.motivoRepiqueNoEnvio ?? null,
        sucesso: input.sucesso,
        erroMensagem: input.erroMensagem ?? null,
      },
    });
  }

  async findUltimoPorCard(cardId: string): Promise<RepiqueCampanhaEnvioRecord | null> {
    return this.prisma.repiqueCampanhaEnvio.findFirst({
      where: { cardId },
      orderBy: { enviadoEm: 'desc' },
    });
  }
}
