// src/modules/whatsappmarketing/infra/database/prisma-whatsapp-message.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IWhatsAppMessageRepository,
  WhatsAppMessageRecord,
} from '../../domain/repositories/whatsapp-message-repository.interface';
import { StatusEntrega } from '../../domain/services/map-delivery-status';

@Injectable()
export class PrismaWhatsAppMessageRepository implements IWhatsAppMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    sessionId: string;
    direction: 'IN' | 'OUT';
    fromNumber: string;
    toNumber: string;
    remoteJid?: string | null;
    body: string;
    timestamp: Date;
    baileysMessageId?: string | null;
    statusEntrega?: StatusEntrega | null;
  }): Promise<void> {
    await this.prisma.whatsAppMessage.create({
      data: {
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        direction: input.direction,
        fromNumber: input.fromNumber,
        toNumber: input.toNumber,
        remoteJid: input.remoteJid ?? null,
        body: input.body,
        timestamp: input.timestamp,
        baileysMessageId: input.baileysMessageId ?? null,
        statusEntrega: input.statusEntrega ?? null,
      },
    });
  }

  async findRecentBySessionAndNumber(
    sessionId: string,
    phoneNumber: string,
    limit: number,
  ): Promise<WhatsAppMessageRecord[]> {
    const messages = await this.prisma.whatsAppMessage.findMany({
      where: {
        sessionId,
        OR: [{ fromNumber: phoneNumber }, { toNumber: phoneNumber }],
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return messages.reverse().map((message) => ({
      id: message.id,
      direction: message.direction as 'IN' | 'OUT',
      body: message.body,
      timestamp: message.timestamp,
      remoteJid: message.remoteJid,
    }));
  }

  async findMostRecentByTenantAndPhone(
    tenantId: string,
    phoneNumber: string,
  ): Promise<{ timestamp: Date } | null> {
    const message = await this.prisma.whatsAppMessage.findFirst({
      where: {
        tenantId,
        OR: [{ fromNumber: phoneNumber }, { toNumber: phoneNumber }],
      },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    return message;
  }

  async findExistingBaileysMessageIds(
    sessionId: string,
    baileysMessageIds: string[],
  ): Promise<string[]> {
    if (baileysMessageIds.length === 0) return [];

    const messages = await this.prisma.whatsAppMessage.findMany({
      where: {
        sessionId,
        baileysMessageId: { in: baileysMessageIds },
      },
      select: { baileysMessageId: true },
    });

    return messages
      .map((message) => message.baileysMessageId)
      .filter((id): id is string => id !== null);
  }

  async updateStatusEntregaByBaileysMessageId(
    sessionId: string,
    baileysMessageId: string,
    statusEntrega: StatusEntrega,
  ): Promise<{ count: number }> {
    return this.prisma.whatsAppMessage.updateMany({
      where: { sessionId, baileysMessageId },
      data: { statusEntrega },
    });
  }
}
