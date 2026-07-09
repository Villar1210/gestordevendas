// src/modules/whatsappmarketing/infra/database/prisma-whatsapp-session.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IWhatsAppSessionRepository,
  WhatsAppSessionRecord,
} from '../../domain/repositories/whatsapp-session-repository.interface';

@Injectable()
export class PrismaWhatsAppSessionRepository implements IWhatsAppSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    ownerUserId?: string | null;
    label: string;
  }): Promise<WhatsAppSessionRecord> {
    return this.prisma.whatsAppSession.create({
      data: {
        tenantId: input.tenantId,
        ownerUserId: input.ownerUserId ?? null,
        label: input.label,
      },
    });
  }

  async findById(id: string): Promise<WhatsAppSessionRecord | null> {
    return this.prisma.whatsAppSession.findUnique({ where: { id } });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<WhatsAppSessionRecord | null> {
    return this.prisma.whatsAppSession.findFirst({ where: { id, tenantId } });
  }

  async findMostRecentByTenant(tenantId: string): Promise<WhatsAppSessionRecord | null> {
    return this.prisma.whatsAppSession.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string, phoneNumber?: string | null): Promise<void> {
    await this.prisma.whatsAppSession.update({
      where: { id },
      data: {
        status,
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
      },
    });
  }

  async updateAiEnabled(id: string, isAiEnabled: boolean): Promise<void> {
    await this.prisma.whatsAppSession.update({
      where: { id },
      data: { isAiEnabled },
    });
  }
}
