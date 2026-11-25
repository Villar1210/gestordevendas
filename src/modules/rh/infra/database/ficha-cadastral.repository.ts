// RH - cadastro completo da equipe interna (25/11/2026).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';

export interface NovaFicha {
  tenantId: string;
  roleId: string;
  nome: string;
  email: string;
  senhaHash: string;
  telefone: string;
  cpf: string;
  cargoNaEmpresa: string;
  ficha: {
    indicadoPor: string;
    cargoPretendido: string;
    jaTrabalhouNoGrupo: boolean;
    superiorIndicadoId: string | null;
    rg: string;
    rgUf: string;
    nomeMae: string;
    nomePai: string;
    dataNascimento: Date;
    paisNascimento: string;
    estadoNascimento: string;
    cidadeNascimento: string;
    estadoCivil: string;
    nomeConjuge: string | null;
    quantidadeFilhos: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    cep: string;
    escolaridade: string;
    possuiCreci: boolean;
    creciTipo: string | null;
    creciNumero: string | null;
    creciValidade: Date | null;
    creciSupervisor: string | null;
    banco: string;
    agencia: string;
    conta: string;
    tipoConta: string;
    tipoPix: string;
    chavePix: string;
    optaPj: boolean;
    cnpj: string | null;
    pjBanco: string | null;
    pjAgencia: string | null;
    pjConta: string | null;
    tamanhoCamisa: string;
    aceiteLgpdEm: Date;
  };
}

const SITUACAO: Record<string, string> = {
  pendente: 'pendente_aprovacao',
  aprovado: 'aprovado',
  rejeitado: 'rejeitado',
};

@Injectable()
export class FichaCadastralRepository {
  constructor(private readonly prisma: PrismaService) {}

  async emailOuCpfJaUsado(email: string, cpf: string): Promise<'email' | 'cpf' | null> {
    const u = await this.prisma.user.findFirst({
      where: { OR: [{ email: { equals: email, mode: 'insensitive' } }, { cpf }] },
      select: { email: true },
    });
    if (!u) return null;
    return u.email.toLowerCase() === email.toLowerCase() ? 'email' : 'cpf';
  }

  // Usuario pendente + ficha numa transacao so (nunca um sem o outro).
  async criarCadastroComFicha(n: NovaFicha): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: n.tenantId,
          roleId: n.roleId,
          name: n.nome,
          email: n.email,
          password: n.senhaHash,
          statusCadastro: 'pendente_aprovacao',
          telefone: n.telefone,
          cpf: n.cpf,
          creci: n.ficha.creciNumero,
          cargoNaEmpresa: n.cargoNaEmpresa,
          cep: n.ficha.cep,
          endereco: `${n.ficha.rua}, ${n.ficha.numero} - ${n.ficha.bairro} - ${n.ficha.cidade}`.slice(0, 200),
        },
        select: { id: true },
      });
      await tx.fichaCadastral.create({ data: { userId: u.id, tenantId: n.tenantId, ...n.ficha } });
      return u;
    });
  }

  // Superiores que o candidato pode indicar (usuarios ativos do Gestor com o
  // cargo certo). So id e nome saem daqui - a rota e publica.
  async superioresComCargo(tenantId: string, cargos: string[]) {
    return this.prisma.user.findMany({
      where: { tenantId, statusCadastro: 'aprovado', cargoHierarquico: { in: cargos } },
      select: { id: true, name: true, cargoHierarquico: true },
      orderBy: { name: 'asc' },
    });
  }

  async superiorValido(tenantId: string, superiorId: string, cargos: string[]): Promise<boolean> {
    const n = await this.prisma.user.count({
      where: { id: superiorId, tenantId, statusCadastro: 'aprovado', cargoHierarquico: { in: cargos } },
    });
    return n === 1;
  }

  // Lista do RH: cadastros da equipe por situacao, com o resumo da ficha.
  async listar(tenantId: string, situacao: 'pendente' | 'aprovado' | 'rejeitado') {
    return this.prisma.user.findMany({
      where: { tenantId, statusCadastro: SITUACAO[situacao], fichaCadastral: { isNot: null } },
      orderBy: { createdAt: situacao === 'pendente' ? 'asc' : 'desc' },
      take: 500,
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        createdAt: true,
        cargoHierarquico: true,
        fichaCadastral: {
          select: {
            indicadoPor: true,
            cargoPretendido: true,
            possuiCreci: true,
            creciTipo: true,
            creciNumero: true,
            creciValidade: true,
            motivoRecusa: true,
            superiorIndicado: { select: { id: true, name: true, cargoHierarquico: true } },
          },
        },
      },
    });
  }

  async contarPorSituacao(tenantId: string) {
    const grupos = await this.prisma.user.groupBy({
      by: ['statusCadastro'],
      where: { tenantId, fichaCadastral: { isNot: null } },
      _count: true,
    });
    const c = (s: string) => grupos.find((g) => g.statusCadastro === s)?._count ?? 0;
    return { pendente: c('pendente_aprovacao'), aprovado: c('aprovado'), rejeitado: c('rejeitado') };
  }

  async fichaCompleta(tenantId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        telefone: true,
        statusCadastro: true,
        createdAt: true,
        fichaCadastral: { include: { superiorIndicado: { select: { id: true, name: true, cargoHierarquico: true } } } },
      },
    });
  }

  async registrarAcessoSensivel(titularId: string, leitorId: string): Promise<void> {
    await this.prisma.fichaAcessoSensivel.create({ data: { titularId, leitorId } });
  }

  async ultimosAcessos(titularId: string) {
    return this.prisma.fichaAcessoSensivel.findMany({
      where: { titularId },
      orderBy: { em: 'desc' },
      take: 10,
      select: { em: true, leitor: { select: { name: true } } },
    });
  }

  async registrarMotivoRecusa(userId: string, motivo: string): Promise<void> {
    await this.prisma.fichaCadastral.updateMany({ where: { userId }, data: { motivoRecusa: motivo } });
  }
}
