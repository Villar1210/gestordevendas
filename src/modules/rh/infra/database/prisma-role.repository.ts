// src/modules/rh/infra/database/prisma-role.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { IRoleRepository, RoleRecord } from '../../domain/repositories/role-repository.interface';

@Injectable()
export class PrismaRoleRepository implements IRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantAndName(tenantId: string, name: string): Promise<RoleRecord | null> {
    return this.prisma.role.findFirst({ where: { tenantId, name } });
  }

  async create(input: { tenantId: string; name: string }): Promise<RoleRecord> {
    return this.prisma.role.create({
      data: { tenantId: input.tenantId, name: input.name },
    });
  }
}
