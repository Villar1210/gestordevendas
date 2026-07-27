// src/modules/vivi_sdr/infra/database/prisma-vivi-conversation.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../config/prisma.service';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';
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
    try {
      const record = await this.prisma.viviConversation.create({
        data: {
          tenantId: input.tenantId,
          whatsappSessionId: input.whatsappSessionId,
          phoneNumber: input.phoneNumber,
        },
      });
      return record as ViviConversationRecord;
    } catch (error) {
      // Indice unico parcial "vivi_conversations_active_session_phone_key"
      // (ver schema.prisma) - mensagem concorrente do mesmo lead ja criou a
      // conversa "em_andamento" entre o find e este create (ver
      // ProcessIncomingMessageUseCase.findOrCreateConversation).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UniqueConstraintViolationError(
          'Ja existe uma ViviConversation em_andamento para esta sessao+telefone.',
        );
      }
      throw error;
    }
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
