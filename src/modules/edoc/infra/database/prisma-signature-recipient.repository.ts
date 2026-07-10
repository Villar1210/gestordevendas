// src/modules/edoc/infra/database/prisma-signature-recipient.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ISignatureRecipientRepository,
  SignatureRecipientRecord,
  SignatureRecipientWithEnvelope,
} from '../../domain/repositories/signature-recipient-repository.interface';

@Injectable()
export class PrismaSignatureRecipientRepository implements ISignatureRecipientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(
    envelopeId: string,
    recipients: { name: string; email: string; order: number }[],
  ): Promise<SignatureRecipientRecord[]> {
    // createMany do Prisma nao retorna os registros criados - cria e busca
    // em seguida, na mesma ordem.
    await this.prisma.signatureRecipient.createMany({
      data: recipients.map((recipient) => ({ ...recipient, envelopeId })),
    });
    return this.findAllByEnvelope(envelopeId);
  }

  async findAllByEnvelope(envelopeId: string): Promise<SignatureRecipientRecord[]> {
    return this.prisma.signatureRecipient.findMany({
      where: { envelopeId },
      orderBy: { order: 'asc' },
    });
  }

  async findByToken(token: string): Promise<SignatureRecipientRecord | null> {
    return this.prisma.signatureRecipient.findUnique({ where: { accessToken: token } });
  }

  async setTokenAndExpiry(id: string, accessToken: string, tokenExpiresAt: Date): Promise<void> {
    await this.prisma.signatureRecipient.update({
      where: { id },
      data: { accessToken, tokenExpiresAt },
    });
  }

  async markSigned(
    id: string,
    input: {
      signatureImageData: string;
      signatureHash: string;
      signerIp: string | null;
      signerUserAgent: string | null;
    },
  ): Promise<SignatureRecipientRecord> {
    return this.prisma.signatureRecipient.update({
      where: { id },
      data: {
        status: 'assinado',
        signedAt: new Date(),
        signatureImageData: input.signatureImageData,
        signatureHash: input.signatureHash,
        signerIp: input.signerIp,
        signerUserAgent: input.signerUserAgent,
      },
    });
  }

  async findNextInOrder(
    envelopeId: string,
    fromOrder: number,
  ): Promise<SignatureRecipientRecord | null> {
    return this.prisma.signatureRecipient.findFirst({
      where: { envelopeId, order: fromOrder + 1 },
    });
  }

  async countPendingBeforeOrder(envelopeId: string, order: number): Promise<number> {
    return this.prisma.signatureRecipient.count({
      where: { envelopeId, order: { lt: order }, status: { not: 'assinado' } },
    });
  }

  async findAllByEmailAndTenant(
    tenantId: string,
    email: string,
  ): Promise<SignatureRecipientWithEnvelope[]> {
    const rows = await this.prisma.signatureRecipient.findMany({
      where: { email, envelope: { tenantId } },
      include: { envelope: { select: { title: true, status: true, signedDocumentUrl: true } } },
      orderBy: { id: 'asc' },
    });
    return rows.map(({ envelope, ...recipient }) => ({
      ...recipient,
      envelopeTitle: envelope.title,
      envelopeStatus: envelope.status,
      envelopeSignedDocumentUrl: envelope.signedDocumentUrl,
    }));
  }
}
