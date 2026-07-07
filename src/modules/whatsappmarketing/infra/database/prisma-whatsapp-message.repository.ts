// src/modules/whatsappmarketing/infra/database/prisma-whatsapp-message.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { IWhatsAppMessageRepository } from '../../domain/repositories/whatsapp-message-repository.interface';

@Injectable()
export class PrismaWhatsAppMessageRepository implements IWhatsAppMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    sessionId: string;
    direction: 'IN' | 'OUT';
    fromNumber: string;
    toNumber: string;
    body: string;
    timestamp: Date;
  }): Promise<void> {
    await this.prisma.whatsAppMessage.create({
      data: {
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        direction: input.direction,
        fromNumber: input.fromNumber,
        toNumber: input.toNumber,
        body: input.body,
        timestamp: input.timestamp,
      },
    });
  }
}
