// src/modules/super_usuario/infra/database/prisma-tenant.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { ITenantRepository, TenantSummary } from '../../domain/repositories/tenant-repository.interface';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';

@Injectable()
export class PrismaTenantRepository implements ITenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Exclui o tenant "Plataforma" por uma propriedade ESTRUTURAL (ter uma
  // Role chamada "Super Usuario"), nao pelo nome do tenant - Tenant.name e
  // editavel por qualquer Administrador (aba "Dados da Empresa"), entao
  // filtrar por nome seria fragil a uma renomeacao (acidental ou nao).
  private get whereExceptPlataforma() {
    return { roles: { none: { name: SUPER_USUARIO_ROLE_NAME } } };
  }

  async findAllExceptPlataforma(): Promise<TenantSummary[]> {
    const rows = await this.prisma.tenant.findMany({
      where: this.whereExceptPlataforma,
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      cnpj: row.cnpj,
      createdAt: row.createdAt,
      totalUsuarios: row._count.users,
    }));
  }

  async findByIdExceptPlataforma(id: string): Promise<TenantSummary | null> {
    const row = await this.prisma.tenant.findFirst({
      where: { id, ...this.whereExceptPlataforma },
      include: { _count: { select: { users: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      cnpj: row.cnpj,
      createdAt: row.createdAt,
      totalUsuarios: row._count.users,
    };
  }
}
