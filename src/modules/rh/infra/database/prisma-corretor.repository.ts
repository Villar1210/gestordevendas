// src/modules/rh/infra/database/prisma-corretor.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ICorretorRepository,
  CorretorRecord,
} from '../../domain/repositories/corretor-repository.interface';

function mapUser(u: {
  id: string; tenantId: string; name: string; email: string;
  statusDisponibilidade: string; telefone: string | null;
  whatsapp: string | null; creci: string | null; createdAt: Date;
}): CorretorRecord {
  return {
    id: u.id, tenantId: u.tenantId, name: u.name, email: u.email,
    statusDisponibilidade: u.statusDisponibilidade,
    telefone: u.telefone, whatsapp: u.whatsapp, creci: u.creci,
    createdAt: u.createdAt,
  };
}

const SELECT = {
  id: true, tenantId: true, name: true, email: true,
  statusDisponibilidade: true, telefone: true, whatsapp: true,
  creci: true, createdAt: true,
};

@Injectable()
export class PrismaCorretorRepository implements ICorretorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  async create(input: {
    tenantId: string; roleId: string; name: string; email: string;
    hashedPassword: string; telefone?: string | null;
    whatsapp?: string | null; creci?: string | null;
  }): Promise<CorretorRecord> {
    const user = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId, roleId: input.roleId,
        name: input.name, email: input.email,
        password: input.hashedPassword,
        mustChangePassword: true,
        telefone: input.telefone ?? null,
        whatsapp: input.whatsapp ?? null,
        creci: input.creci ?? null,
      },
      select: SELECT,
    });
    return mapUser(user);
  }

  async findAllByTenantAndRole(tenantId: string, roleId: string): Promise<CorretorRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, roleId }, orderBy: { name: 'asc' }, select: SELECT,
    });
    return users.map(mapUser);
  }

  async findOnlineByTenantAndRole(tenantId: string, roleId: string): Promise<CorretorRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, roleId, statusDisponibilidade: 'online' },
      orderBy: { name: 'asc' }, select: SELECT,
    });
    return users.map(mapUser);
  }

  async updateStatusDisponibilidade(userId: string, tenantId: string, status: string): Promise<void> {
    await this.prisma.user.updateMany({ where: { id: userId, tenantId }, data: { statusDisponibilidade: status } });
  }
}
