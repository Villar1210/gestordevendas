// Rotulos, limites e formatadores dos Concorrentes (BII Fatia 3). Limites
// espelham o backend (domain/services/concorrente.ts) - o backend valida de
// novo e e a fonte da verdade.
import { formatMoedaCompacta } from "./constants";
import type { Concorrente, FaseConcorrente } from "./types-concorrentes";

export const FASES: { value: FaseConcorrente; label: string; classe: string }[] = [
  { value: "lancamento", label: "Lançamento", classe: "border-blue-100 bg-blue-50 text-blue-700" },
  { value: "obras", label: "Em obras", classe: "border-violet-100 bg-violet-50 text-violet-700" },
  { value: "pronto", label: "Pronto", classe: "border-green-100 bg-green-50 text-green-700" },
];

export function getFase(fase: string) {
  return FASES.find((f) => f.value === fase) ?? { value: fase, label: fase, classe: "border-slate-200 bg-slate-50 text-slate-600" };
}

export const LIMITES = {
  tipologias: 10,
  areaMin: 10,
  areaMax: 1000,
  precoMin: 10_000,
  precoMax: 100_000_000,
  dormitoriosMax: 10,
  unidadesMax: 100_000,
  nome: 150,
  construtora: 150,
  endereco: 200,
  fonte: 120,
  fonteUrl: 500,
  observacoes: 1000,
  descricao: 100,
};

// mesma faixa "plausivel" do backend (fora dela o R$/m2 nao entra na conta)
export const PRECO_M2_MIN = 500;
export const PRECO_M2_MAX = 60_000;

export function precoM2(preco: number | null, area: number | null): number | null {
  if (preco === null || area === null || !Number.isFinite(preco) || !Number.isFinite(area) || area <= 0) return null;
  const v = preco / area;
  return v >= PRECO_M2_MIN && v <= PRECO_M2_MAX ? v : null;
}

export function formatFaixaPreco(c: Pick<Concorrente, "calculado">): string {
  const { precoMin, precoMax } = c.calculado;
  if (precoMin === null) return "—";
  if (precoMax === null || precoMax === precoMin) return `${formatMoedaCompacta(precoMin)}`;
  return `${formatMoedaCompacta(precoMin)} – ${formatMoedaCompacta(precoMax)}`;
}

// Cor do marcador de concorrente no mapa (diferente dos pontos de ITBI, que
// usam a escala azul/verde): violeta.
export const COR_CONCORRENTE = "#7c3aed";

// Link de fonte: so exibe https (o backend ja recusa outra coisa).
export function linkSeguro(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
