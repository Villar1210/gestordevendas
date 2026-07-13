// src/modules/vivi_sdr/infra/database/prisma-vivi-conversation.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IViviConversationRepository,
  ViviConversationRecord,
  ViviConversationUpdateInput,
} from '../../domain/repositories/vivi-conversation-repository.interface';

@Injectable()
export class PrismaViviConversationRepository implements IViviConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    whatsappSessionId: string;
    phoneNumber: string;
  }): Promise<ViviConversationRecord> {
    const record = await this.prisma.viviConversation.create({
      data: {
        tenantId: input.tenantId,
        whatsappSessionId: input.whatsappSessionId,
        phoneNumber: input.phoneNumber,
      },
    });
    return record as ViviConversationRecord;
  }

  async findActiveBySessionAndPhone(
    whatsappSessionId: string,
    phoneNumber: string,
  ): Promise<ViviConversationRecord | null> {
    const record = await this.prisma.viviConversation.findFirst({
      where: { whatsappSessionId, phoneNumber, status: 'em_andamento' },
      orderBy: { createdAt: 'desc' },
    });
    return record as ViviConversationRecord | null;
  }

  async findLatestBySessionAndPhone(
    whatsappSessionId: string,
    phoneNumber: string,
  ): Promise<ViviConversationRecord | null> {
    const record = await this.prisma.viviConversation.findFirst({
      where: { whatsappSessionId, phoneNumber },
      orderBy: { createdAt: 'desc' },
    });
    return record as ViviConversationRecord | null;
  }

  async update(id: string, data: ViviConversationUpdateInput): Promise<ViviConversationRecord> {
    const record = await this.prisma.viviConversation.update({
      where: { id },
      data,
    });
    return record as ViviConversationRecord;
  }

  async findAllByTenant(tenantId: string): Promise<ViviConversationRecord[]> {
    const records = await this.prisma.viviConversation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return records as ViviConversationRecord[];
  }
}
