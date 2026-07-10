// src/modules/edoc/infra/database/prisma-signature-event.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ISignatureEventRepository,
  SignatureEventRecord,
  SignatureEventType,
} from '../../domain/repositories/signature-event-repository.interface';

@Injectable()
export class PrismaSignatureEventRepository implements ISignatureEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    envelopeId: string;
    recipientId?: string | null;
    type: SignatureEventType;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<SignatureEventRecord> {
    const row = await this.prisma.signatureEvent.create({
      data: {
        envelopeId: input.envelopeId,
        recipientId: input.recipientId ?? null,
        type: input.type,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    return { ...row, type: row.type as SignatureEventType };
  }

  async existsByRecipientAndType(recipientId: string, type: SignatureEventType): Promise<boolean> {
    const count = await this.prisma.signatureEvent.count({ where: { recipientId, type } });
    return count > 0;
  }
}
