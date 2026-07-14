// src/modules/auth/infra/database/prisma-user.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IUserRepository,
  ITenantOnboardingRepository,
  UserWithRole,
} from '../../domain/repositories/user-repository.interface';

@Injectable()
export class PrismaUserRepository
  implements IUserRepository, ITenantOnboardingRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async updateName(userId: string, name: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { name },
    });
  }

  async setTwoFactorEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: enabled },
    });
  }

  async registerCompanyWithOwner(input: {
    companyName: string;
    ownerName: string;
    email: string;
    hashedPassword: string;
  }): Promise<{ tenantId: string; userId: string }> {
    // Transacao "tudo ou nada": se qualquer passo falhar, nada e criado
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: input.companyName },
      });

      const role = await tx.role.create({
        data: { name: 'Administrador', tenantId: tenant.id },
      });

      const user = await tx.user.create({
        data: {
          name: input.ownerName,
          email: input.email,
          password: input.hashedPassword,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      return { tenantId: tenant.id, userId: user.id };
    });

    return result;
  }
}
