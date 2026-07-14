// src/modules/configuracoes/infra/database/prisma-tenant-config.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ITenantConfigRepository,
  TenantConfigRecord,
  UpdateTenantConfigInput,
} from '../../domain/repositories/tenant-config-repository.interface';

const SELECT_FIELDS = {
  id: true,
  name: true,
  cnpj: true,
  endereco: true,
  numero: true,
  complemento: true,
  bairro: true,
  cep: true,
} as const;

@Injectable()
export class PrismaTenantConfigRepository implements ITenantConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(tenantId: string): Promise<TenantConfigRecord | null> {
    return this.prisma.tenant.findUnique({ where: { id: tenantId }, select: SELECT_FIELDS });
  }

  async update(tenantId: string, input: UpdateTenantConfigInput): Promise<TenantConfigRecord> {
    return this.prisma.tenant.update({ where: { id: tenantId }, data: input, select: SELECT_FIELDS });
  }
}
