// src/modules/campanhas_sms/infra/database/prisma-campanha.repository.ts
// So Prisma tipado. Toda leitura de tela comeca por tenantId; escrita de tela
// condicional (updateMany/deleteMany where { tenantId, id, status }).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  AlteracaoCampanha,
  CampanhaRecord,
  ContatoParaClique,
  ContatoRecente,
  ContatoRecord,
  Contagens,
  FiltroContatos,
  ICampanhaRepository,
  NovaCampanha,
  NovoContato,
} from '../../domain/repositories/campanha-repository.interface';
import { STATUS_CONTATO, StatusCampanha, StatusContato } from '../../domain/services/campanha-regras';

type LinhaCampanha = Omit<CampanhaRecord, 'status'> & { status: string };
type LinhaContato = Omit<ContatoRecord, 'status'> & { status: string };

const paraCampanha = (r: LinhaCampanha): CampanhaRecord => ({ ...r, status: r.status as StatusCampanha });
const paraContato = (r: LinhaContato): ContatoRecord => ({ ...r, status: r.status as StatusContato });

const SELECT_CONTATO = {
  id: true,
  campanhaId: true,
  tenantId: true,
  nome: true,
  primeiroNome: true,
  telefone: true,
  corretor: true,
  referencia: true,
  status: true,
  codigo: true,
  tentativas: true,
  provedorMensagemId: true,
  erro: true,
  enviadoEm: true,
  entregueEm: true,
  cliques: true,
  primeiroCliqueEm: true,
  ultimoCliqueEm: true,
  respostaTexto: true,
  respondidoEm: true,
  optoutEm: true,
  createdAt: true,
} as const;

function contagemVazia(): Contagens {
  const base = Object.fromEntries(STATUS_CONTATO.map((s) => [s, 0])) as Record<StatusContato, number>;
  return { ...base, total: 0, comClique: 0, cliquesTotais: 0, comResposta: 0 };
}

@Injectable()
export class PrismaCampanhaRepository implements ICampanhaRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- campanha ----------------
  async criar(d: NovaCampanha): Promise<CampanhaRecord> {
    return paraCampanha(await this.prisma.campanhaSms.create({ data: d }));
  }

  async buscar(tenantId: string, id: string): Promise<CampanhaRecord | null> {
    const r = await this.prisma.campanhaSms.findFirst({ where: { tenantId, id } });
    return r ? paraCampanha(r) : null;
  }

  async listar(tenantId: string, limite: number): Promise<CampanhaRecord[]> {
    const rs = await this.prisma.campanhaSms.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limite });
    return rs.map(paraCampanha);
  }

  contarCampanhas(tenantId: string): Promise<number> {
    return this.prisma.campanhaSms.count({ where: { tenantId } });
  }

  async atualizar(tenantId: string, id: string, dados: AlteracaoCampanha, statusPermitidos: StatusCampanha[]): Promise<boolean> {
    const r = await this.prisma.campanhaSms.updateMany({ where: { tenantId, id, status: { in: statusPermitidos } }, data: dados });
    return r.count === 1;
  }

  async mudarStatus(
    tenantId: string,
    id: string,
    de: StatusCampanha[],
    para: StatusCampanha,
    extra: { iniciadaEm?: Date; concluidaEm?: Date } = {},
  ): Promise<boolean> {
    const r = await this.prisma.campanhaSms.updateMany({ where: { tenantId, id, status: { in: de } }, data: { status: para, ...extra } });
    return r.count === 1;
  }

  async contagens(campanhaIds: string[]): Promise<Map<string, Contagens>> {
    const mapa = new Map<string, Contagens>();
    if (campanhaIds.length === 0) return mapa;
    for (const id of campanhaIds) mapa.set(id, contagemVazia());
    const porStatus = await this.prisma.campanhaSmsContato.groupBy({
      by: ['campanhaId', 'status'],
      where: { campanhaId: { in: campanhaIds } },
      _count: { _all: true },
    });
    for (const g of porStatus) {
      const c = mapa.get(g.campanhaId)!;
      if ((STATUS_CONTATO as readonly string[]).includes(g.status)) c[g.status as StatusContato] = g._count._all;
      c.total += g._count._all;
    }
    const cliques = await this.prisma.campanhaSmsContato.groupBy({
      by: ['campanhaId'],
      where: { campanhaId: { in: campanhaIds }, cliques: { gt: 0 } },
      _count: { _all: true },
      _sum: { cliques: true },
    });
    for (const g of cliques) {
      const c = mapa.get(g.campanhaId)!;
      c.comClique = g._count._all;
      c.cliquesTotais = g._sum.cliques ?? 0;
    }
    const respostas = await this.prisma.campanhaSmsContato.groupBy({
      by: ['campanhaId'],
      where: { campanhaId: { in: campanhaIds }, respondidoEm: { not: null } },
      _count: { _all: true },
    });
    for (const g of respostas) mapa.get(g.campanhaId)!.comResposta = g._count._all;
    return mapa;
  }

  // ---------------- contatos ----------------
  contarContatos(campanhaId: string): Promise<number> {
    return this.prisma.campanhaSmsContato.count({ where: { campanhaId } });
  }

  async telefonesDaCampanha(campanhaId: string): Promise<Set<string>> {
    const rs = await this.prisma.campanhaSmsContato.findMany({ where: { campanhaId }, select: { telefone: true } });
    return new Set(rs.map((r) => r.telefone));
  }

  async inserirContatos(tenantId: string, campanhaId: string, contatos: NovoContato[]): Promise<number> {
    let total = 0;
    for (let i = 0; i < contatos.length; i += 1000) {
      const r = await this.prisma.campanhaSmsContato.createMany({
        data: contatos.slice(i, i + 1000).map((c) => ({ ...c, tenantId, campanhaId })),
        skipDuplicates: true,
      });
      total += r.count;
    }
    return total;
  }

  async apagarContatos(tenantId: string, campanhaId: string): Promise<number> {
    const r = await this.prisma.campanhaSmsContato.deleteMany({ where: { tenantId, campanhaId } });
    return r.count;
  }

  private whereContatos(tenantId: string, campanhaId: string, f: FiltroContatos) {
    const busca = f.busca?.trim();
    const digitos = busca?.replace(/\D/g, '');
    return {
      tenantId,
      campanhaId,
      ...(f.status ? { status: f.status } : {}),
      ...(f.somenteClicou ? { cliques: { gt: 0 } } : {}),
      ...(f.somenteRespondeu ? { respondidoEm: { not: null } } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: 'insensitive' as const } },
              { corretor: { contains: busca, mode: 'insensitive' as const } },
              ...(digitos && digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : []),
            ],
          }
        : {}),
    };
  }

  async listarContatos(tenantId: string, campanhaId: string, filtro: FiltroContatos, pagina: number, porPagina: number) {
    const where = this.whereContatos(tenantId, campanhaId, filtro);
    const [itens, total] = await Promise.all([
      this.prisma.campanhaSmsContato.findMany({
        where,
        select: SELECT_CONTATO,
        orderBy: [{ respondidoEm: { sort: 'desc', nulls: 'last' } }, { primeiroCliqueEm: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.campanhaSmsContato.count({ where }),
    ]);
    return { itens: itens.map(paraContato), total };
  }

  async contatosParaExportar(tenantId: string, campanhaId: string, filtro: FiltroContatos, limite: number): Promise<ContatoRecord[]> {
    const rs = await this.prisma.campanhaSmsContato.findMany({
      where: this.whereContatos(tenantId, campanhaId, filtro),
      select: SELECT_CONTATO,
      orderBy: { createdAt: 'asc' },
      take: limite,
    });
    return rs.map(paraContato);
  }

  async maiorPrimeiroNome(campanhaId: string): Promise<string> {
    const rs = await this.prisma.campanhaSmsContato.findMany({
      where: { campanhaId, status: 'pendente' },
      select: { primeiroNome: true },
      distinct: ['primeiroNome'],
    });
    return rs.reduce((maior, r) => (r.primeiroNome.length > maior.length ? r.primeiroNome : maior), '');
  }

  async cancelarPendentes(campanhaId: string): Promise<number> {
    const r = await this.prisma.campanhaSmsContato.updateMany({ where: { campanhaId, status: 'pendente' }, data: { status: 'cancelado' } });
    return r.count;
  }

  async codigosEmUso(codigos: string[]): Promise<Set<string>> {
    if (codigos.length === 0) return new Set();
    const [contatos, campanhas] = await Promise.all([
      this.prisma.campanhaSmsContato.findMany({ where: { codigo: { in: codigos } }, select: { codigo: true } }),
      this.prisma.campanhaSms.findMany({ where: { codigoTeste: { in: codigos } }, select: { codigoTeste: true } }),
    ]);
    return new Set([...contatos.map((c) => c.codigo), ...campanhas.map((c) => c.codigoTeste)]);
  }

  // ---------------- opt-out ----------------
  listarOptouts(tenantId: string, limite: number) {
    return this.prisma.smsOptOut.findMany({
      where: { tenantId },
      select: { telefone: true, origem: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
  }

  async telefonesEmOptout(tenantId: string, telefones: string[]): Promise<Set<string>> {
    if (telefones.length === 0) return new Set();
    const rs = await this.prisma.smsOptOut.findMany({ where: { tenantId, telefone: { in: telefones } }, select: { telefone: true } });
    return new Set(rs.map((r) => r.telefone));
  }

  async registrarOptout(tenantId: string, telefone: string, origem: 'resposta' | 'manual' | 'importacao'): Promise<void> {
    await this.prisma.smsOptOut.upsert({
      where: { tenantId_telefone: { tenantId, telefone } },
      create: { tenantId, telefone, origem },
      update: {},
    });
  }

  async marcarOptoutPendentes(tenantId: string, telefone: string, quando: Date): Promise<number> {
    const r = await this.prisma.campanhaSmsContato.updateMany({
      where: { tenantId, telefone, status: 'pendente' },
      data: { status: 'optout', optoutEm: quando },
    });
    return r.count;
  }

  // ---------------- envio (job) ----------------
  async campanhasEnviando(): Promise<CampanhaRecord[]> {
    const rs = await this.prisma.campanhaSms.findMany({ where: { status: 'enviando' }, orderBy: { iniciadaEm: 'asc' }, take: 50 });
    return rs.map(paraCampanha);
  }

  async pendentes(campanhaId: string, limite: number): Promise<ContatoRecord[]> {
    const rs = await this.prisma.campanhaSmsContato.findMany({
      where: { campanhaId, status: 'pendente' },
      select: SELECT_CONTATO,
      orderBy: { createdAt: 'asc' },
      take: limite,
    });
    return rs.map(paraContato);
  }

  async reservar(contatoId: string): Promise<boolean> {
    const r = await this.prisma.campanhaSmsContato.updateMany({
      where: { id: contatoId, status: 'pendente' },
      data: { status: 'enviando', tentativas: { increment: 1 } },
    });
    return r.count === 1;
  }

  async marcarEnviado(contatoId: string, provedorMensagemId: string, quando: Date): Promise<void> {
    await this.prisma.campanhaSmsContato.updateMany({
      where: { id: contatoId, status: 'enviando' },
      data: { status: 'enviado', provedorMensagemId: provedorMensagemId.slice(0, 100), enviadoEm: quando, erro: null },
    });
  }

  async devolverPendente(contatoId: string, erro: string): Promise<void> {
    await this.prisma.campanhaSmsContato.updateMany({ where: { id: contatoId, status: 'enviando' }, data: { status: 'pendente', erro } });
  }

  async marcarFalhou(contatoId: string, erro: string): Promise<void> {
    await this.prisma.campanhaSmsContato.updateMany({ where: { id: contatoId, status: 'enviando' }, data: { status: 'falhou', erro } });
  }

  async marcarBloqueado(contatoId: string): Promise<void> {
    await this.prisma.campanhaSmsContato.updateMany({ where: { id: contatoId, status: 'pendente' }, data: { status: 'bloqueado' } });
  }

  async existeAEnviar(campanhaId: string): Promise<boolean> {
    const n = await this.prisma.campanhaSmsContato.count({ where: { campanhaId, status: { in: ['pendente', 'enviando'] } } });
    return n > 0;
  }

  async falharTravados(erro: string): Promise<number> {
    const r = await this.prisma.campanhaSmsContato.updateMany({ where: { status: 'enviando' }, data: { status: 'falhou', erro } });
    return r.count;
  }

  // ---------------- link curto ----------------
  async contatoPorCodigo(codigo: string): Promise<ContatoParaClique | null> {
    const r = await this.prisma.campanhaSmsContato.findUnique({
      where: { codigo },
      select: { id: true, campanhaId: true, campanha: { select: { linkDestino: true } } },
    });
    return r ? { contatoId: r.id, campanhaId: r.campanhaId, linkDestino: r.campanha.linkDestino } : null;
  }

  async campanhaPorCodigoTeste(codigo: string): Promise<{ id: string; linkDestino: string } | null> {
    return this.prisma.campanhaSms.findUnique({ where: { codigoTeste: codigo }, select: { id: true, linkDestino: true } });
  }

  async registrarClique(contatoId: string, quando: Date): Promise<void> {
    await this.prisma.campanhaSmsContato.update({ where: { id: contatoId }, data: { cliques: { increment: 1 }, ultimoCliqueEm: quando } });
    // primeiro clique: so grava se ainda estiver vazio (condicional, sem corrida)
    await this.prisma.campanhaSmsContato.updateMany({ where: { id: contatoId, primeiroCliqueEm: null }, data: { primeiroCliqueEm: quando } });
  }

  // ---------------- webhook ----------------
  async atualizarEntrega(provedorMensagemId: string, status: 'entregue' | 'falhou' | 'enviado', quando: Date, erro?: string): Promise<number> {
    if (status === 'enviado') return 0; // SENT so confirma o que ja sabemos
    if (status === 'entregue') {
      const r = await this.prisma.campanhaSmsContato.updateMany({
        where: { provedorMensagemId, status: { in: ['enviado', 'falhou'] } },
        data: { status: 'entregue', entregueEm: quando, erro: null },
      });
      return r.count;
    }
    const r = await this.prisma.campanhaSmsContato.updateMany({
      where: { provedorMensagemId, status: 'enviado' },
      data: { status: 'falhou', erro: erro ?? 'Não entregue pela operadora.' },
    });
    return r.count;
  }

  async contatosRecentesDoTelefone(telefone: string, desde: Date): Promise<ContatoRecente[]> {
    const rs = await this.prisma.campanhaSmsContato.findMany({
      where: { telefone, enviadoEm: { gte: desde } },
      select: { id: true, tenantId: true, campanhaId: true, enviadoEm: true },
      orderBy: { enviadoEm: 'desc' },
      take: 50,
    });
    return rs.filter((r): r is typeof r & { enviadoEm: Date } => r.enviadoEm !== null);
  }

  async registrarResposta(contatoId: string, texto: string, quando: Date, optout: boolean): Promise<void> {
    await this.prisma.campanhaSmsContato.update({
      where: { id: contatoId },
      data: { respostaTexto: texto || null, respondidoEm: quando, ...(optout ? { status: 'optout', optoutEm: quando } : {}) },
    });
  }
}
