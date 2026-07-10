// src/modules/edoc/infra/database/prisma-signature-envelope.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ISignatureEnvelopeRepository,
  SignatureEnvelopeRecord,
  SignatureEnvelopeWithCount,
} from '../../domain/repositories/signature-envelope-repository.interface';

@Injectable()
export class PrismaSignatureEnvelopeRepository implements ISignatureEnvelopeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    title: string;
    documentUrl: string;
    documentHash: string;
    createdByUserId: string;
  }): Promise<SignatureEnvelopeRecord> {
    return this.prisma.signatureEnvelope.create({ data: input });
  }

  async findById(id: string): Promise<SignatureEnvelopeRecord | null> {
    return this.prisma.signatureEnvelope.findUnique({ where: { id } });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<SignatureEnvelopeRecord | null> {
    return this.prisma.signatureEnvelope.findFirst({ where: { id, tenantId } });
  }

  async findAllByTenant(tenantId: string): Promise<SignatureEnvelopeWithCount[]> {
    const rows = await this.prisma.signatureEnvelope.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { recipients: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      title: row.title,
      status: row.status,
      documentUrl: row.documentUrl,
      documentHash: row.documentHash,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      signedDocumentUrl: row.signedDocumentUrl,
      recipientsCount: row._count.recipients,
    }));
  }

  async updateStatus(id: string, status: string): Promise<SignatureEnvelopeRecord> {
    return this.prisma.signatureEnvelope.update({ where: { id }, data: { status } });
  }

  async completeWithEvent(id: string): Promise<SignatureEnvelopeRecord> {
    return this.prisma.$transaction(async (tx) => {
      const envelope = await tx.signatureEnvelope.update({
        where: { id },
        data: { status: 'concluido', completedAt: new Date() },
      });
      await tx.signatureEvent.create({
        data: { envelopeId: id, type: 'concluido' },
      });
      return envelope;
    });
  }

  async updateSignedDocumentUrl(id: string, signedDocumentUrl: string): Promise<void> {
    await this.prisma.signatureEnvelope.update({ where: { id }, data: { signedDocumentUrl } });
  }
}
