// src/modules/rh/infra/database/prisma-cadastro.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  ICadastroRepository,
  CadastroRecord,
  CreateCadastroInput,
  SuperiorCandidateRecord,
} from '../../domain/repositories/cadastro-repository.interface';

type PrismaUserWithRole = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  creci: string | null;
  nomeImobiliaria: string | null;
  cnpj: string | null;
  creciJ: string | null;
  cargoNaEmpresa: string | null;
  cargoHierarquico: string | null;
  superiorId: string | null;
  tipoCliente: string | null;
  cep: string | null;
  endereco: string | null;
  statusCadastro: string;
  roleId: string;
  createdAt: Date;
  role: { name: string };
};

@Injectable()
export class PrismaCadastroRepository implements ICadastroRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(user: PrismaUserWithRole): CadastroRecord {
    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      telefone: user.telefone,
      cpf: user.cpf,
      creci: user.creci,
      nomeImobiliaria: user.nomeImobiliaria,
      cnpj: user.cnpj,
      creciJ: user.creciJ,
      cargoNaEmpresa: user.cargoNaEmpresa,
      cargoHierarquico: user.cargoHierarquico,
      superiorId: user.superiorId,
      tipoCliente: user.tipoCliente,
      cep: user.cep,
      endereco: user.endereco,
      statusCadastro: user.statusCadastro,
      roleId: user.roleId,
      roleName: user.role.name,
      createdAt: user.createdAt,
    };
  }

  async findByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  async create(input: CreateCadastroInput): Promise<CadastroRecord> {
    const user = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        roleId: input.roleId,
        name: input.name,
        email: input.email,
        password: input.hashedPassword,
        statusCadastro: 'pendente_aprovacao',
        telefone: input.telefone,
        cpf: input.cpf,
        creci: input.creci,
        nomeImobiliaria: input.nomeImobiliaria,
        cnpj: input.cnpj,
        creciJ: input.creciJ,
        cargoNaEmpresa: input.cargoNaEmpresa,
        tipoCliente: input.tipoCliente,
        cep: input.cep,
        endereco: input.endereco,
      },
      include: { role: true },
    });
    return this.toRecord(user);
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<CadastroRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: { role: true },
    });
    return user ? this.toRecord(user) : null;
  }

  async findAllPendentesByTenant(tenantId: string): Promise<CadastroRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, statusCadastro: 'pendente_aprovacao' },
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => this.toRecord(user));
  }

  async aprovar(input: {
    id: string;
    cargoHierarquico?: string;
    superiorId?: string;
  }): Promise<CadastroRecord> {
    const user = await this.prisma.user.update({
      where: { id: input.id },
      data: {
        statusCadastro: 'aprovado',
        cargoHierarquico: input.cargoHierarquico,
        superiorId: input.superiorId,
      },
      include: { role: true },
    });
    return this.toRecord(user);
  }

  async rejeitar(id: string): Promise<CadastroRecord> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { statusCadastro: 'rejeitado' },
      include: { role: true },
    });
    return this.toRecord(user);
  }

  async findPossiveisSuperioresByTenant(tenantId: string): Promise<SuperiorCandidateRecord[]> {
    return this.prisma.user.findMany({
      where: { tenantId, cargoHierarquico: { not: null } },
      select: { id: true, name: true, cargoHierarquico: true },
      orderBy: { name: 'asc' },
    });
  }
}
