// src/modules/gestao_imobiliaria/infra/database/prisma-inquilino-comprador.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IInquilinoCompradorRepository,
  InquilinoCompradorRecord,
  InquilinoCompradorWritableFields,
  InquilinoDocumentoRecord,
} from '../../domain/repositories/inquilino-comprador-repository.interface';

type PrismaInquilinoRow = {
  id: string;
  tenantId: string;
  nome: string;
  cpfCnpj: string | null;
  telefone: string;
  email: string | null;
  profissao: string | null;
  rendaDeclarada: { toNumber(): number } | null;
  statusAnaliseCredito: string;
  observacoesAnalise: string | null;
  createdAt: Date;
};

@Injectable()
export class PrismaInquilinoCompradorRepository implements IInquilinoCompradorRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: PrismaInquilinoRow): InquilinoCompradorRecord {
    return { ...row, rendaDeclarada: row.rendaDeclarada?.toNumber() ?? null };
  }

  async create(
    input: InquilinoCompradorWritableFields & {
      tenantId: string;
      nome: string;
      telefone: string;
    },
  ): Promise<InquilinoCompradorRecord> {
    const row = await this.prisma.inquilinoComprador.create({ data: input });
    return this.toRecord(row);
  }

  async update(
    id: string,
    input: InquilinoCompradorWritableFields,
  ): Promise<InquilinoCompradorRecord> {
    const row = await this.prisma.inquilinoComprador.update({ where: { id }, data: input });
    return this.toRecord(row);
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<InquilinoCompradorRecord | null> {
    const row = await this.prisma.inquilinoComprador.findFirst({ where: { id, tenantId } });
    return row ? this.toRecord(row) : null;
  }

  async findAllByTenant(tenantId: string): Promise<InquilinoCompradorRecord[]> {
    const rows = await this.prisma.inquilinoComprador.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findDocumentosByInquilino(inquilinoId: string): Promise<InquilinoDocumentoRecord[]> {
    return this.prisma.inquilinoDocumento.findMany({
      where: { inquilinoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addDocumento(input: {
    tenantId: string;
    inquilinoId: string;
    tipo: string;
    url: string;
    nomeArquivo: string;
  }): Promise<InquilinoDocumentoRecord> {
    return this.prisma.inquilinoDocumento.create({ data: input });
  }

  async findDocumentoByIdAndTenant(
    documentoId: string,
    tenantId: string,
  ): Promise<InquilinoDocumentoRecord | null> {
    return this.prisma.inquilinoDocumento.findFirst({ where: { id: documentoId, tenantId } });
  }

  async deleteDocumento(documentoId: string): Promise<void> {
    await this.prisma.inquilinoDocumento.delete({ where: { id: documentoId } });
  }
}
