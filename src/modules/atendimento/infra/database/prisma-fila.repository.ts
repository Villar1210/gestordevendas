// src/modules/atendimento/infra/database/prisma-fila.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IFilaRepository,
  FilaRecord,
  FilaWithUsuarioIds,
} from '../../domain/repositories/fila-repository.interface';

@Injectable()
export class PrismaFilaRepository implements IFilaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    nome: string;
    descricao?: string | null;
  }): Promise<FilaRecord> {
    return this.prisma.fila.create({
      data: { tenantId: input.tenantId, nome: input.nome, descricao: input.descricao ?? null },
    });
  }

  async findAllByTenant(tenantId: string): Promise<FilaWithUsuarioIds[]> {
    const rows = await this.prisma.fila.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { usuarios: { select: { userId: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      nome: row.nome,
      descricao: row.descricao,
      createdAt: row.createdAt,
      usuarioIds: row.usuarios.map((u) => u.userId),
    }));
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<FilaRecord | null> {
    return this.prisma.fila.findFirst({ where: { id, tenantId } });
  }

  async findByTenantAndNome(tenantId: string, nome: string): Promise<FilaRecord | null> {
    return this.prisma.fila.findFirst({ where: { tenantId, nome } });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.fila.count({ where: { tenantId } });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.fila.delete({ where: { id } });
  }

  async addUsuario(filaId: string, userId: string): Promise<void> {
    await this.prisma.filaUsuario.upsert({
      where: { filaId_userId: { filaId, userId } },
      create: { filaId, userId },
      update: {},
    });
  }

  async removeUsuario(filaId: string, userId: string): Promise<void> {
    await this.prisma.filaUsuario.deleteMany({ where: { filaId, userId } });
  }

  async isUsuarioInFila(filaId: string, userId: string): Promise<boolean> {
    const found = await this.prisma.filaUsuario.findUnique({
      where: { filaId_userId: { filaId, userId } },
    });
    return !!found;
  }

  async findFilaIdsByUsuario(userId: string): Promise<string[]> {
    const rows = await this.prisma.filaUsuario.findMany({
      where: { userId },
      select: { filaId: true },
    });
    return rows.map((r) => r.filaId);
  }
}
