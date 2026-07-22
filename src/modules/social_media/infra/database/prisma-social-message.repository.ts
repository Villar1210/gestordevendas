// src/modules/social_media/infra/database/prisma-social-message.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ISocialMessageRepository,
  CreateSocialMessageInput,
  SocialMessageRecord,
} from '../../domain/repositories/social-message-repository.interface';

@Injectable()
export class PrismaSocialMessageRepository implements ISocialMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSocialMessageInput): Promise<SocialMessageRecord> {
    const message = await this.prisma.socialMessage.create({ data: input });
    return message as SocialMessageRecord;
  }

  // Busca as `limit` mais recentes (ordem desc) e reverte para cronologica -
  // mesmo padrao ja usado por PrismaWhatsAppMessageRepository.findRecentBySessionAndNumber.
  async findRecentByAccountAndExternalId(
    socialAccountId: string,
    identificadorExterno: string,
    limit: number,
  ): Promise<SocialMessageRecord[]> {
    const messages = await this.prisma.socialMessage.findMany({
      where: { socialAccountId, identificadorExterno },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return messages.reverse() as SocialMessageRecord[];
  }
}
