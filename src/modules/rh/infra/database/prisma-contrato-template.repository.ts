// src/modules/rh/infra/database/prisma-contrato-template.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IContratoTemplateRepository,
  ContratoTemplateRecord,
} from '../../domain/repositories/contrato-template-repository.interface';

@Injectable()
export class PrismaContratoTemplateRepository implements IContratoTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { tenantId: string; nome: string; corpo: string }): Promise<ContratoTemplateRecord> {
    return this.prisma.contratoTemplate.create({
      data: { tenantId: input.tenantId, nome: input.nome, corpo: input.corpo },
    });
  }

  async findPadraoByTenant(tenantId: string): Promise<ContratoTemplateRecord | null> {
    return this.prisma.contratoTemplate.findFirst({
      where: { tenantId, padrao: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, input: { nome: string; corpo: string }): Promise<ContratoTemplateRecord> {
    return this.prisma.contratoTemplate.update({
      where: { id },
      data: { nome: input.nome, corpo: input.corpo },
    });
  }
}
