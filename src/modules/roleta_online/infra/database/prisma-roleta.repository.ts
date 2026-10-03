// src/modules/roleta_online/infra/database/prisma-roleta.repository.ts
// Fatia 2 (Sorteio da vez). Camada de INFRA: contrato do dominio -> Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IRoletaRepository,
  RoletaRecord,
  RoletaDados,
  ParticipanteRecord,
  PosicaoRecord,
  SorteioRecord,
  ExecucaoRecord,
  OrigemSorteio,
  TipoRoleta,
  ModoSorteio,
} from '../../domain/repositories/roleta-repository.interface';

const INCLUDE = {
  empreendimentos: { select: { empreendimentoId: true } },
  corretores: { select: { userId: true } },
} as const;

const CARGOS_SUPERVISORES = ['diretor', 'diretor_regional', 'superintendente', 'gerente', 'gerente_regional'];

type RoletaRow = {
  id: string;
  tenantId: string;
  nome: string;
  tipo: string;
  standId: string | null;
  padrao: boolean;
  ativa: boolean;
  modoSorteio: string;
  horariosSorteio: string[];
  minutosSorteioSeguranca: number;
  filaDia: string | null;
  createdAt: Date;
  updatedAt: Date;
  empreendimentos: Array<{ empreendimentoId: string }>;
  corretores: Array<{ userId: string }>;
};

function toRecord(r: RoletaRow): RoletaRecord {
  return {
    id: r.id,
    tenantId: r.tenantId,
    nome: r.nome,
    tipo: r.tipo as TipoRoleta,
    standId: r.standId,
    padrao: r.padrao,
    ativa: r.ativa,
    modoSorteio: r.modoSorteio as ModoSorteio,
    horariosSorteio: r.horariosSorteio,
    minutosSorteioSeguranca: r.minutosSorteioSeguranca,
    filaDia: r.filaDia,
    empreendimentoIds: r.empreendimentos.map((e) => e.empreendimentoId),
    corretorIds: r.corretores.map((c) => c.userId),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

@Injectable()
export class PrismaRoletaRepository implements IRoletaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByTenant(tenantId: string): Promise<RoletaRecord[]> {
    const rows = await this.prisma.roleta.findMany({ where: { tenantId }, include: INCLUDE, orderBy: { nome: 'asc' } });
    return rows.map(toRecord);
  }

  async listAtivasComHorario(): Promise<RoletaRecord[]> {
    const rows = await this.prisma.roleta.findMany({
      where: { ativa: true, NOT: { horariosSorteio: { isEmpty: true } } },
      include: INCLUDE,
    });
    return rows.map(toRecord);
  }

  async findById(id: string, tenantId: string): Promise<RoletaRecord | null> {
    const row = await this.prisma.roleta.findFirst({ where: { id, tenantId }, include: INCLUDE });
    return row ? toRecord(row) : null;
  }

  async create(tenantId: string, dados: RoletaDados): Promise<RoletaRecord> {
    const row = await this.prisma.roleta.create({ data: { tenantId, ...dados }, include: INCLUDE });
    return toRecord(row);
  }

  async update(id: string, tenantId: string, dados: RoletaDados): Promise<RoletaRecord> {
    await this.prisma.roleta.updateMany({ where: { id, tenantId }, data: dados });
    return (await this.findById(id, tenantId))!;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.roleta.deleteMany({ where: { id, tenantId } });
  }

  async limparPadrao(tenantId: string, excetoId: string): Promise<void> {
    await this.prisma.roleta.updateMany({ where: { tenantId, padrao: true, NOT: { id: excetoId } }, data: { padrao: false } });
  }

  async setEmpreendimentos(roletaId: string, empreendimentoIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.roletaEmpreendimento.deleteMany({ where: { roletaId } }),
      this.prisma.roletaEmpreendimento.createMany({
        data: [...new Set(empreendimentoIds)].map((empreendimentoId) => ({ roletaId, empreendimentoId })),
      }),
    ]);
  }

  async setCorretores(roletaId: string, userIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.roletaCorretor.deleteMany({ where: { roletaId } }),
      this.prisma.roletaCorretor.createMany({ data: [...new Set(userIds)].map((userId) => ({ roletaId, userId })) }),
    ]);
  }

  async findAtivaPorEmpreendimento(tenantId: string, empreendimentoId: string): Promise<RoletaRecord | null> {
    const row = await this.prisma.roleta.findFirst({
      where: { tenantId, ativa: true, tipo: 'produto', empreendimentos: { some: { empreendimentoId } } },
      include: INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return row ? toRecord(row) : null;
  }

  async findPadrao(tenantId: string): Promise<RoletaRecord | null> {
    const row = await this.prisma.roleta.findFirst({ where: { tenantId, ativa: true, padrao: true }, include: INCLUDE });
    return row ? toRecord(row) : null;
  }

  async findEmpreendimentoDoCard(cardId: string): Promise<string | null> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { empreendimentoId: true, imovel: { select: { empreendimentoId: true } } },
    });
    return card?.empreendimentoId ?? card?.imovel?.empreendimentoId ?? null;
  }

  async listParticipantes(roleta: RoletaRecord, diaSemana: number): Promise<ParticipanteRecord[]> {
    const SELECT_USER = { id: true, name: true, statusDisponibilidade: true, tenantId: true } as const;
    let users: Array<{ id: string; name: string; statusDisponibilidade: string; tenantId: string }> = [];
    if (roleta.tipo === 'stand') {
      if (!roleta.standId) return [];
      const escalas = await this.prisma.escalaPlantao.findMany({
        where: { standId: roleta.standId, diaSemana },
        select: { user: { select: SELECT_USER } },
      });
      users = escalas.map((e) => e.user);
    } else {
      const vinculos = await this.prisma.roletaCorretor.findMany({
        where: { roletaId: roleta.id },
        select: { user: { select: SELECT_USER } },
      });
      users = vinculos.map((v) => v.user);
    }
    const vistos = new Set<string>();
    return users
      .filter((u) => u.tenantId === roleta.tenantId && !vistos.has(u.id) && vistos.add(u.id))
      .map((u) => ({ userId: u.id, nome: u.name, statusDisponibilidade: u.statusDisponibilidade }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async listPosicoes(roletaId: string): Promise<PosicaoRecord[]> {
    return this.prisma.roletaPosicao.findMany({
      where: { roletaId },
      orderBy: { posicao: 'asc' },
      select: { userId: true, posicao: true, entrouEm: true, ultimoLeadEm: true },
    });
  }

  async reiniciarFila(roletaId: string, dia: string, ordemUserIds: string[]): Promise<void> {
    const agora = new Date();
    await this.prisma.$transaction([
      this.prisma.roletaPosicao.deleteMany({ where: { roletaId } }),
      this.prisma.roletaPosicao.createMany({
        data: ordemUserIds.map((userId, i) => ({ roletaId, userId, posicao: i + 1, entrouEm: agora })),
      }),
      this.prisma.roleta.update({ where: { id: roletaId }, data: { filaDia: dia } }),
    ]);
  }

  async adicionarAoFim(roletaId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      const existentes = await tx.roletaPosicao.findMany({ where: { roletaId }, select: { userId: true, posicao: true } });
      const ja = new Set(existentes.map((e) => e.userId));
      let max = existentes.reduce((m, e) => Math.max(m, e.posicao), 0);
      const novos = userIds.filter((id) => !ja.has(id));
      if (novos.length === 0) return;
      await tx.roletaPosicao.createMany({
        data: novos.map((userId) => ({ roletaId, userId, posicao: ++max })),
        skipDuplicates: true,
      });
    });
  }

  async moverParaFim(roletaId: string, userId: string, quando: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const agg = await tx.roletaPosicao.aggregate({ where: { roletaId }, _max: { posicao: true } });
      const fim = (agg._max.posicao ?? 0) + 1;
      await tx.roletaPosicao.upsert({
        where: { roletaId_userId: { roletaId, userId } },
        create: { roletaId, userId, posicao: fim, ultimoLeadEm: quando },
        update: { posicao: fim, ultimoLeadEm: quando },
      });
    });
  }

  async registrarSorteio(input: {
    roletaId: string;
    origem: OrigemSorteio;
    disparadoPorId: string | null;
    horario: string | null;
    ordem: Array<{ userId: string; nome: string }>;
  }): Promise<SorteioRecord> {
    const row = await this.prisma.roletaSorteio.create({
      data: {
        roletaId: input.roletaId,
        origem: input.origem,
        disparadoPorId: input.disparadoPorId,
        horario: input.horario,
        ordem: input.ordem,
      },
      include: { disparadoPor: { select: { name: true } } },
    });
    return this.toSorteio(row);
  }

  async listSorteios(roletaId: string, limite: number): Promise<SorteioRecord[]> {
    const rows = await this.prisma.roletaSorteio.findMany({
      where: { roletaId },
      orderBy: { createdAt: 'desc' },
      take: limite,
      include: { disparadoPor: { select: { name: true } } },
    });
    return rows.map((r) => this.toSorteio(r));
  }

  private toSorteio(r: {
    id: string;
    roletaId: string;
    origem: string;
    disparadoPorId: string | null;
    horario: string | null;
    ordem: unknown;
    createdAt: Date;
    disparadoPor: { name: string } | null;
  }): SorteioRecord {
    return {
      id: r.id,
      roletaId: r.roletaId,
      origem: r.origem as OrigemSorteio,
      disparadoPorId: r.disparadoPorId,
      disparadoPorNome: r.disparadoPor?.name ?? null,
      horario: r.horario,
      ordem: (Array.isArray(r.ordem) ? r.ordem : []) as Array<{ userId: string; nome: string }>,
      createdAt: r.createdAt,
    };
  }

  async findExecucao(roletaId: string, dia: string, horario: string): Promise<ExecucaoRecord | null> {
    return this.prisma.roletaHorarioExecucao.findUnique({
      where: { roletaId_dia_horario: { roletaId, dia, horario } },
      select: { avisadoEm: true, sorteadoEm: true },
    });
  }

  async marcarAvisado(roletaId: string, dia: string, horario: string, quando: Date): Promise<void> {
    await this.prisma.roletaHorarioExecucao.upsert({
      where: { roletaId_dia_horario: { roletaId, dia, horario } },
      create: { roletaId, dia, horario, avisadoEm: quando },
      update: { avisadoEm: quando },
    });
  }

  async marcarSorteado(roletaId: string, dia: string, horario: string, quando: Date): Promise<void> {
    await this.prisma.roletaHorarioExecucao.upsert({
      where: { roletaId_dia_horario: { roletaId, dia, horario } },
      create: { roletaId, dia, horario, sorteadoEm: quando },
      update: { sorteadoEm: quando },
    });
  }

  async listSupervisores(tenantId: string, standId: string | null): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { role: { name: 'Administrador' } },
          { cargoHierarquico: { in: CARGOS_SUPERVISORES } },
          ...(standId ? [{ cargoHierarquico: 'coordenador', standId }] : []),
        ],
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async existeStand(tenantId: string, standId: string): Promise<boolean> {
    return (await this.prisma.stand.count({ where: { id: standId, tenantId } })) > 0;
  }

  async filtrarEmpreendimentosDoTenant(tenantId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.empreendimento.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async filtrarUsuariosDoTenant(tenantId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.user.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async nomesUsuarios(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
