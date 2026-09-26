// src/modules/configuracoes/infra/database/prisma-tenant-config.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
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
  limiteMensagensViviDia: true,
  acaoLimiteVivi: true,
  slug: true,
  dominio: true,
} as const;

@Injectable()
export class PrismaTenantConfigRepository implements ITenantConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(tenantId: string): Promise<TenantConfigRecord | null> {
    return this.prisma.tenant.findUnique({ where: { id: tenantId }, select: SELECT_FIELDS });
  }

  async update(tenantId: string, input: UpdateTenantConfigInput): Promise<TenantConfigRecord> {
    try {
      return await this.prisma.tenant.update({ where: { id: tenantId }, data: input, select: SELECT_FIELDS });
    } catch (error) {
      // slug e dominio sao unicos entre todas as empresas.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Este endereço de site ou domínio já está em uso por outra empresa.');
      }
      throw error;
    }
  }
}
