// src/modules/vivi_sdr/infra/database/prisma-social-conversation.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ISocialConversationRepository,
  SocialConversationRecord,
  SocialConversationUpdateInput,
} from '../../domain/repositories/social-conversation-repository.interface';

@Injectable()
export class PrismaSocialConversationRepository implements ISocialConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    socialAccountId: string;
    identificadorExterno: string;
  }): Promise<SocialConversationRecord> {
    const record = await this.prisma.socialConversation.create({
      data: {
        tenantId: input.tenantId,
        socialAccountId: input.socialAccountId,
        identificadorExterno: input.identificadorExterno,
      },
    });
    return record as SocialConversationRecord;
  }

  async findActiveByAccountAndExternalId(
    socialAccountId: string,
    identificadorExterno: string,
  ): Promise<SocialConversationRecord | null> {
    const record = await this.prisma.socialConversation.findFirst({
      where: { socialAccountId, identificadorExterno, status: 'em_andamento' },
      orderBy: { createdAt: 'desc' },
    });
    return record as SocialConversationRecord | null;
  }

  async findLatestByAccountAndExternalId(
    socialAccountId: string,
    identificadorExterno: string,
  ): Promise<SocialConversationRecord | null> {
    const record = await this.prisma.socialConversation.findFirst({
      where: { socialAccountId, identificadorExterno },
      orderBy: { createdAt: 'desc' },
    });
    return record as SocialConversationRecord | null;
  }

  async update(id: string, data: SocialConversationUpdateInput): Promise<SocialConversationRecord> {
    const record = await this.prisma.socialConversation.update({
      where: { id },
      data,
    });
    return record as SocialConversationRecord;
  }
}
