// src/modules/auth/infra/database/prisma-password-reset-token.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IPasswordResetTokenRepository,
  PasswordResetTokenRecord,
} from '../../domain/repositories/password-reset-token-repository.interface';

@Injectable()
export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { userId: string; token: string; expiresAt: Date }): Promise<void> {
    await this.prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        token: input.token,
        expiresAt: input.expiresAt,
      },
    });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });
  }

  async findByToken(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });
  }

  async consumir(id: string): Promise<boolean> {
    const { count } = await this.prisma.passwordResetToken.updateMany({
      where: { id, used: false },
      data: { used: true },
    });
    return count === 1;
  }
}
