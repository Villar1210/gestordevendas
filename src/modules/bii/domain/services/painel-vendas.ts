// src/modules/bii/domain/services/painel-vendas.ts
// Calculos do Painel de Vendas sobre linhas ja lidas do banco. Funcoes PURAS.
// Regras (docs/bii/fatia1/CONTRATO_PAINEL.md):
// - ganho = card distinto que ENTROU em "Fechamento" no periodo (vale a
//   primeira entrada no periodo); perda = idem para "Repique".
// - comparacao do nome da etapa no momento do evento, sem acento/caixa.
// - VGV = soma de Card.value dos ganhos (valor nulo/0 conta 0).
import { arredondar2, percentual, soma } from './estatistica';
import { ehEtapaGanho, ehEtapaPerda } from './normalizar';
import { resumoCiclos } from './ciclo-venda';
import { chaveMes } from './periodo';
import { chaveMotivo, rotuloMotivo } from './motivo-repique';

export interface CardBase {
  ownerId: string | null;
  origem: string;
  value: number;
  createdAt: Date;
}

export interface EventoBase {
  cardId: string;
  toStageNome: string;
  motivoRepique: string | null;
  ocorridoEm: Date;
  card: CardBase;
}

export interface LeadBase {
  cardId: string;
  ownerId: string | null;
  origem: string;
}

export interface ResumoVendas {
  leadsNovos: number;
  ganhos: number;
  perdidos: number;
  conversaoPct: number | null;
  vgvGanho: number;
  ticketMedio: number | null;
  cicloMedioDias: number | null;
  cicloMedianoDias: number | null;
}

function valorSeguro(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

// Primeira entrada (no periodo) de cada card nas etapas que satisfazem o
// predicado.
function primeiraEntradaPorCard<E extends EventoBase>(eventos: E[], predicado: (nome: string) => boolean): E[] {
  const porCard = new Map<string, E>();
  for (const e of eventos) {
    if (!predicado(e.toStageNome)) continue;
    const atual = porCard.get(e.cardId);
    if (!atual || e.ocorridoEm.getTime() < atual.ocorridoEm.getTime()) porCard.set(e.cardId, e);
  }
  return [...porCard.values()];
}

export function ganhosDistintos<E extends EventoBase>(eventos: E[]): E[] {
  return primeiraEntradaPorCard(eventos, ehEtapaGanho);
}

export function perdasDistintas<E extends EventoBase>(eventos: E[]): E[] {
  return primeiraEntradaPorCard(eventos, ehEtapaPerda);
}

export function calcularResumo(leads: LeadBase[], eventos: EventoBase[]): ResumoVendas {
  const ganhos = ganhosDistintos(eventos);
  const perdas = perdasDistintas(eventos);
  const valores = ganhos.map((g) => valorSeguro(g.card.value));
  const vgvGanho = arredondar2(soma(valores));
  const comValor = valores.filter((v) => v > 0);
  const ciclos = resumoCiclos(ganhos.map((g) => ({ criadoEm: g.card.createdAt, ganhoEm: g.ocorridoEm })));
  return {
    leadsNovos: leads.length,
    ganhos: ganhos.length,
    perdidos: perdas.length,
    conversaoPct: percentual(ganhos.length, leads.length),
    vgvGanho,
    ticketMedio: comValor.length === 0 ? null : arredondar2(soma(comValor) / comValor.length),
    cicloMedioDias: ciclos.medio,
    cicloMedianoDias: ciclos.mediano,
  };
}

export function calcularVgvPorMes(
  eventos: EventoBase[],
  meses: string[],
): { mes: string; vgv: number; ganhos: number }[] {
  const porMes = new Map(meses.map((m) => [m, { vgv: 0, ganhos: 0 }]));
  for (const g of ganhosDistintos(eventos)) {
    const linha = porMes.get(chaveMes(g.ocorridoEm));
    if (!linha) continue;
    linha.vgv += valorSeguro(g.card.value);
    linha.ganhos += 1;
  }
  return meses.map((mes) => {
    const l = porMes.get(mes)!;
    return { mes, vgv: arredondar2(l.vgv), ganhos: l.ganhos };
  });
}

export interface LinhaRanking {
  corretorId: string;
  nome: string;
  leads: number;
  ganhos: number;
  conversaoPct: number | null;
  vgv: number;
}

// So cards com dono entram (lead sem corretor nao tem a quem atribuir).
// Ordem: VGV desc, depois ganhos desc, depois nome.
export function calcularRanking(
  leads: LeadBase[],
  eventos: EventoBase[],
  nomes: Map<string, string>,
): LinhaRanking[] {
  const linhas = new Map<string, { leads: number; ganhos: number; vgv: number }>();
  const linha = (id: string) => {
    let l = linhas.get(id);
    if (!l) {
      l = { leads: 0, ganhos: 0, vgv: 0 };
      linhas.set(id, l);
    }
    return l;
  };
  for (const lead of leads) if (lead.ownerId) linha(lead.ownerId).leads += 1;
  for (const g of ganhosDistintos(eventos)) {
    if (!g.card.ownerId) continue;
    const l = linha(g.card.ownerId);
    l.ganhos += 1;
    l.vgv += valorSeguro(g.card.value);
  }
  return [...linhas.entries()]
    .map(([corretorId, l]) => ({
      corretorId,
      nome: nomes.get(corretorId) ?? 'Usuário removido',
      leads: l.leads,
      ganhos: l.ganhos,
      conversaoPct: percentual(l.ganhos, l.leads),
      vgv: arredondar2(l.vgv),
    }))
    .sort((a, b) => b.vgv - a.vgv || b.ganhos - a.ganhos || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function calcularPorOrigem(
  leads: LeadBase[],
  eventos: EventoBase[],
): { origem: string; leads: number; ganhos: number; conversaoPct: number | null }[] {
  const linhas = new Map<string, { leads: number; ganhos: number }>();
  const linha = (o: string) => {
    let l = linhas.get(o);
    if (!l) {
      l = { leads: 0, ganhos: 0 };
      linhas.set(o, l);
    }
    return l;
  };
  for (const lead of leads) linha(lead.origem).leads += 1;
  for (const g of ganhosDistintos(eventos)) linha(g.card.origem).ganhos += 1;
  return [...linhas.entries()]
    .map(([origem, l]) => ({ origem, leads: l.leads, ganhos: l.ganhos, conversaoPct: percentual(l.ganhos, l.leads) }))
    .sort((a, b) => b.leads - a.leads || b.ganhos - a.ganhos || a.origem.localeCompare(b.origem));
}

export function calcularMotivosPerda(
  eventos: EventoBase[],
): { motivo: string; rotulo: string; quantidade: number; pct: number }[] {
  const perdas = perdasDistintas(eventos);
  const contagem = new Map<string, number>();
  for (const p of perdas) {
    const chave = chaveMotivo(p.motivoRepique);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([motivo, quantidade]) => ({
      motivo,
      rotulo: rotuloMotivo(motivo),
      quantidade,
      pct: percentual(quantidade, perdas.length) ?? 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo));
}
