// src/modules/bii/domain/services/concorrente.ts
// Fatia 3 - Concorrentes (cadastro manual). Regras PURAS (sem Nest/Prisma):
// validacao, R$/m2 por tipologia, mediana do concorrente, % vendido, vendas
// por mes e "desatualizado". Validacoes devolvem a mensagem de erro (ou null)
// em vez de lancar excecao HTTP - quem chama traduz para 400.
// Contrato: docs/bii/fatia3/CONTRATO_CONCORRENTES.md.
import { arredondar1, arredondar2, mediana } from './estatistica';
import { dataUtc } from './data-utc';

export const FASES_CONCORRENTE = ['lancamento', 'obras', 'pronto'] as const;
export type FaseConcorrente = (typeof FASES_CONCORRENTE)[number];

export const MAX_TIPOLOGIAS = 10;
export const MAX_CONCORRENTES_POR_TENANT = 300;
export const AREA_MIN_M2 = 10;
export const AREA_MAX_M2 = 1_000;
export const PRECO_MIN = 10_000;
export const PRECO_MAX = 100_000_000;
export const DORMITORIOS_MAX = 10;
export const UNIDADES_MAX = 100_000;
// mesma faixa de R$/m2 "plausivel" do ITBI (analise-endereco.ts)
export const PRECO_M2_MIN_VALIDO = 500;
export const PRECO_M2_MAX_VALIDO = 60_000;
export const DIAS_DESATUALIZADO = 90;
const DIA_MS = 86_400_000;
const MES_MEDIO_DIAS = 30.4375;

export interface TipologiaEntrada {
  descricao: string;
  dormitorios: number | null;
  areaPrivativa: number;
  precoDe: number;
  precoAte: number | null;
}

export interface VendasEntrada {
  totalUnidades: number | null;
  unidadesVendidas: number | null;
}

export interface TipologiaCalculada extends TipologiaEntrada {
  precoM2De: number | null;
  precoM2Ate: number | null;
}

export interface ConcorrenteCalculado {
  precoM2Mediano: number | null;
  precoM2Min: number | null;
  precoM2Max: number | null;
  precoMin: number | null;
  precoMax: number | null;
  percentualVendido: number | null;
  vendasPorMes: number | null;
  desatualizado: boolean;
}

function numeroFinito(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// Valida a lista de tipologias. null = ok.
export function validarTipologias(tipologias: TipologiaEntrada[]): string | null {
  if (!Array.isArray(tipologias) || tipologias.length === 0) return 'Informe ao menos uma tipologia.';
  if (tipologias.length > MAX_TIPOLOGIAS) return `Informe no máximo ${MAX_TIPOLOGIAS} tipologias.`;
  for (let i = 0; i < tipologias.length; i++) {
    const t = tipologias[i];
    const n = i + 1;
    if (!t.descricao || !t.descricao.trim()) return `Descreva a tipologia nº ${n}.`;
    if (!numeroFinito(t.areaPrivativa) || t.areaPrivativa < AREA_MIN_M2 || t.areaPrivativa > AREA_MAX_M2) {
      return `A área privativa da tipologia nº ${n} deve ficar entre ${AREA_MIN_M2} e ${AREA_MAX_M2} m².`;
    }
    if (!numeroFinito(t.precoDe) || t.precoDe < PRECO_MIN || t.precoDe > PRECO_MAX) {
      return `O preço da tipologia nº ${n} deve ficar entre R$ 10 mil e R$ 100 milhões.`;
    }
    if (t.precoAte !== null) {
      if (!numeroFinito(t.precoAte) || t.precoAte > PRECO_MAX) {
        return `O preço máximo da tipologia nº ${n} deve ficar até R$ 100 milhões.`;
      }
      if (t.precoAte < t.precoDe) return `Na tipologia nº ${n}, o preço "até" não pode ser menor que o preço "a partir de".`;
    }
    if (t.dormitorios !== null && (!Number.isInteger(t.dormitorios) || t.dormitorios < 0 || t.dormitorios > DORMITORIOS_MAX)) {
      return `Os dormitórios da tipologia nº ${n} devem ficar entre 0 e ${DORMITORIOS_MAX}.`;
    }
  }
  return null;
}

export function validarVendas(v: VendasEntrada): string | null {
  for (const [valor, rotulo] of [
    [v.totalUnidades, 'O total de unidades'],
    [v.unidadesVendidas, 'As unidades vendidas'],
  ] as const) {
    if (valor !== null && (!Number.isInteger(valor) || valor < 0 || valor > UNIDADES_MAX)) {
      return `${rotulo} deve ser um número inteiro entre 0 e ${UNIDADES_MAX.toLocaleString('pt-BR')}.`;
    }
  }
  if (v.totalUnidades === 0) return 'O total de unidades deve ser maior que zero.';
  if (v.totalUnidades !== null && v.unidadesVendidas !== null && v.unidadesVendidas > v.totalUnidades) {
    return 'As unidades vendidas não podem passar do total de unidades.';
  }
  return null;
}

// "YYYY-MM-DD" -> meia-noite UTC (coluna @db.Date, ver data-utc.ts). Data
// inexistente (31/02) ou fora de 1990..2100 -> null.
export function parseDataLancamento(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (ano < 1990 || ano > 2100) return null;
  const d = dataUtc(ano, mes - 1, dia);
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d;
}

function precoM2Valido(preco: number | null, area: number): number | null {
  if (preco === null || !numeroFinito(preco) || !numeroFinito(area) || area <= 0) return null;
  const v = preco / area;
  return v >= PRECO_M2_MIN_VALIDO && v <= PRECO_M2_MAX_VALIDO ? arredondar2(v) : null;
}

export function calcularTipologia(t: TipologiaEntrada): TipologiaCalculada {
  return { ...t, precoM2De: precoM2Valido(t.precoDe, t.areaPrivativa), precoM2Ate: precoM2Valido(t.precoAte, t.areaPrivativa) };
}

export function calcularConcorrente(
  tipologias: TipologiaCalculada[],
  vendas: VendasEntrada & { dataLancamento: Date | null },
  atualizadoEm: Date,
  agora: Date,
): ConcorrenteCalculado {
  const m2De = tipologias.map((t) => t.precoM2De).filter((v): v is number => v !== null);
  const m2Todos = [...m2De, ...tipologias.map((t) => t.precoM2Ate).filter((v): v is number => v !== null)];
  const precos = [...tipologias.map((t) => t.precoDe), ...tipologias.map((t) => t.precoAte).filter((v): v is number => v !== null)];
  const med = mediana(m2De);

  let percentualVendido: number | null = null;
  let vendasPorMes: number | null = null;
  const { totalUnidades, unidadesVendidas, dataLancamento } = vendas;
  if (totalUnidades !== null && totalUnidades > 0 && unidadesVendidas !== null) {
    percentualVendido = arredondar1((Math.min(unidadesVendidas, totalUnidades) / totalUnidades) * 100);
  }
  if (unidadesVendidas !== null && dataLancamento && dataLancamento.getTime() <= agora.getTime()) {
    const meses = Math.max(1, (agora.getTime() - dataLancamento.getTime()) / DIA_MS / MES_MEDIO_DIAS);
    vendasPorMes = arredondar1(unidadesVendidas / meses);
  }

  return {
    precoM2Mediano: med === null ? null : arredondar2(med),
    precoM2Min: m2Todos.length ? Math.min(...m2Todos) : null,
    precoM2Max: m2Todos.length ? Math.max(...m2Todos) : null,
    precoMin: precos.length ? Math.min(...precos) : null,
    precoMax: precos.length ? Math.max(...precos) : null,
    percentualVendido,
    vendasPorMes,
    desatualizado: agora.getTime() - atualizadoEm.getTime() > DIAS_DESATUALIZADO * DIA_MS,
  };
}

// fonteUrl: so https, sem credencial embutida, sem espaco/controle. So e
// EXIBIDA (o servidor nunca busca). null = ok.
export function validarFonteUrl(url: string): string | null {
  if (/[\s\u0000-\u001f\u007f]/.test(url)) return 'O link da fonte tem caracteres inválidos.';
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'Informe um link válido começando com https://';
  }
  if (u.protocol !== 'https:') return 'O link da fonte deve começar com https://';
  if (u.username || u.password) return 'O link da fonte não pode conter usuário ou senha.';
  if (!u.hostname.includes('.')) return 'Informe um link válido começando com https://';
  return null;
}

// Texto livre: sem controle/bidi (mesma regra do endereco), espacos colapsados
// (observacoes mantem quebra de linha simples).
export function limparTextoCurto(texto: string): string {
  return texto
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function limparTextoLongo(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Concorrentes dentro do raio da analise, mais proximos primeiro, ate "limite".
// Generico: recebe qualquer item com lat/lng (o use case passa a resposta ja
// montada).
export function concorrentesNoRaio<T extends { lat: number; lng: number }>(
  itens: T[],
  centro: { lat: number; lng: number },
  raioMetros: number,
  distancia: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
  limite = 50,
): Array<T & { distanciaMetros: number }> {
  return itens
    .map((c) => ({ ...c, distanciaMetros: Math.round(distancia(centro, c)) }))
    .filter((c) => c.distanciaMetros <= raioMetros)
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros)
    .slice(0, limite);
}

export function resumirConcorrentes(itens: { calculado: { precoM2Mediano: number | null }; totalUnidades: number | null }[]): {
  quantidade: number;
  precoM2Mediano: number | null;
  unidadesTotais: number | null;
} {
  const m2 = itens.map((c) => c.calculado.precoM2Mediano).filter((v): v is number => v !== null);
  const unidades = itens.map((c) => c.totalUnidades).filter((v): v is number => v !== null);
  const med = mediana(m2);
  return {
    quantidade: itens.length,
    precoM2Mediano: med === null ? null : arredondar2(med),
    unidadesTotais: unidades.length ? unidades.reduce((a, b) => a + b, 0) : null,
  };
}
