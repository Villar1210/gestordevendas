// src/modules/edoc/infra/database/prisma-signature-field.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ISignatureFieldRepository,
  SignatureFieldRecord,
} from '../../domain/repositories/signature-field-repository.interface';

@Injectable()
export class PrismaSignatureFieldRepository implements ISignatureFieldRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(
    envelopeId: string,
    fields: {
      recipientId: string;
      tipo: string;
      pageNumber: number;
      xPercent: number;
      yPercent: number;
      widthPercent?: number;
      heightPercent?: number;
    }[],
  ): Promise<SignatureFieldRecord[]> {
    // createMany do Prisma nao retorna os registros criados - cria e busca
    // em seguida (mesmo padrao de PrismaSignatureRecipientRepository).
    await this.prisma.signatureField.createMany({
      data: fields.map((field) => ({ ...field, envelopeId })),
    });
    return this.findAllByEnvelope(envelopeId);
  }

  async findAllByEnvelope(envelopeId: string): Promise<SignatureFieldRecord[]> {
    return this.prisma.signatureField.findMany({ where: { envelopeId } });
  }

  async findAllByRecipient(recipientId: string): Promise<SignatureFieldRecord[]> {
    return this.prisma.signatureField.findMany({ where: { recipientId } });
  }
}
