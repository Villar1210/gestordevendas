// src/modules/social_media/infra/database/prisma-social-account.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ISocialAccountRepository,
  CreateSocialAccountInput,
  UpdateSocialAccountInput,
  SocialAccountRecord,
} from '../../domain/repositories/social-account-repository.interface';

@Injectable()
export class PrismaSocialAccountRepository implements ISocialAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSocialAccountInput): Promise<SocialAccountRecord> {
    return this.prisma.socialAccount.create({ data: input });
  }

  async findAllByTenant(tenantId: string): Promise<SocialAccountRecord[]> {
    return this.prisma.socialAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<SocialAccountRecord | null> {
    return this.prisma.socialAccount.findUnique({ where: { id } });
  }

  async findByTenantCanalAndExternalId(
    tenantId: string,
    canal: string,
    externalId: string,
  ): Promise<SocialAccountRecord | null> {
    return this.prisma.socialAccount.findFirst({ where: { tenantId, canal, externalId } });
  }

  async findByCanalAndExternalId(canal: string, externalId: string): Promise<SocialAccountRecord | null> {
    return this.prisma.socialAccount.findFirst({ where: { canal, externalId } });
  }

  async update(id: string, input: UpdateSocialAccountInput): Promise<SocialAccountRecord> {
    return this.prisma.socialAccount.update({ where: { id }, data: input });
  }
}
