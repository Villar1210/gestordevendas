// src/modules/gestao_imobiliaria/infra/database/prisma-inquilino-comprador.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IInquilinoCompradorRepository,
  InquilinoCompradorRecord,
  InquilinoCompradorWritableFields,
} from '../../domain/repositories/inquilino-comprador-repository.interface';

@Injectable()
export class PrismaInquilinoCompradorRepository implements IInquilinoCompradorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: InquilinoCompradorWritableFields & {
      tenantId: string;
      nome: string;
      telefone: string;
    },
  ): Promise<InquilinoCompradorRecord> {
    return this.prisma.inquilinoComprador.create({ data: input });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<InquilinoCompradorRecord | null> {
    return this.prisma.inquilinoComprador.findFirst({ where: { id, tenantId } });
  }

  async findAllByTenant(tenantId: string): Promise<InquilinoCompradorRecord[]> {
    return this.prisma.inquilinoComprador.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
    });
  }
}
