// src/modules/rh/infra/database/prisma-corretor.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ICorretorRepository,
  CorretorRecord,
} from '../../domain/repositories/corretor-repository.interface';

@Injectable()
export class PrismaCorretorRepository implements ICorretorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  async create(input: {
    tenantId: string;
    roleId: string;
    name: string;
    email: string;
    hashedPassword: string;
  }): Promise<CorretorRecord> {
    const user = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        roleId: input.roleId,
        name: input.name,
        email: input.email,
        password: input.hashedPassword,
        // Onboarding do Corretor: este metodo so e chamado por
        // CreateCorretorUseCase (Administrador cadastrando um corretor) -
        // o proprio corretor nunca escolheu essa senha, mesmo quando o
        // Administrador digita uma especifica (nao so no caso auto-gerado).
        mustChangePassword: true,
      },
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      statusDisponibilidade: user.statusDisponibilidade,
      createdAt: user.createdAt,
    };
  }

  async findAllByTenantAndRole(tenantId: string, roleId: string): Promise<CorretorRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, roleId },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      statusDisponibilidade: user.statusDisponibilidade,
      createdAt: user.createdAt,
    }));
  }

  async findOnlineByTenantAndRole(tenantId: string, roleId: string): Promise<CorretorRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, roleId, statusDisponibilidade: 'online' },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      statusDisponibilidade: user.statusDisponibilidade,
      createdAt: user.createdAt,
    }));
  }

  async updateStatusDisponibilidade(
    userId: string,
    tenantId: string,
    status: string,
  ): Promise<void> {
    // updateMany (nao update) porque "id" sozinho e a unica chave unica do
    // Prisma aqui - updateMany permite combinar id + tenantId no filtro
    // sem exigir um indice composto unico.
    await this.prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { statusDisponibilidade: status },
    });
  }
}
