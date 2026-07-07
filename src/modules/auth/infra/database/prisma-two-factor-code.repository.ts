// src/modules/auth/infra/database/prisma-two-factor-code.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ITwoFactorCodeRepository,
  TwoFactorCodeRecord,
} from '../../domain/repositories/two-factor-code-repository.interface';

@Injectable()
export class PrismaTwoFactorCodeRepository implements ITwoFactorCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { userId: string; code: string; expiresAt: Date }): Promise<string> {
    const record = await this.prisma.twoFactorCode.create({
      data: {
        userId: input.userId,
        code: input.code,
        expiresAt: input.expiresAt,
      },
    });
    return record.id;
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.twoFactorCode.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });
  }

  async findById(id: string): Promise<TwoFactorCodeRecord | null> {
    return this.prisma.twoFactorCode.findUnique({ where: { id } });
  }

  async markAsUsed(id: string): Promise<void> {
    await this.prisma.twoFactorCode.update({
      where: { id },
      data: { used: true },
    });
  }
}
