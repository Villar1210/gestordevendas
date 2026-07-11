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
    recipients: { name: string; email: string; role: string; order: number }[],
  ): Promise<SignatureRecipientRecord[]> {
    // NAO usa prisma.signatureRecipient.createMany() + busca em seguida: com
    // "order" agora sendo por GRUPO de role (Fatia 3), varios participantes
    // podem empatar em order (ex: 1 destinatario + 1 remetente + 1 testemunha,
    // todos order=1) - reordenar por "order" na leitura de volta quebraria o
    // mapeamento por indice que CreateEnvelopeUseCase faz logo em seguida
    // (field.recipientIndex -> recipients[i].id). Uma transacao de creates
    // individuais preserva exatamente a ordem do array de entrada.
    return this.prisma.$transaction(
      recipients.map((recipient) =>
        this.prisma.signatureRecipient.create({ data: { ...recipient, envelopeId } }),
      ),
    );
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
