// Opcoes, faixas de cor e formatadores da Analise por Endereco (BII Fatia 2).
import { formatDataIso, formatDateOnlyBr, formatMoeda, formatNumero } from "./constants";
import type { PeriodoMeses, PrecisaoGeocodificacao, RaioMetros, TipoImovelItbi } from "./types-endereco";

export const RAIO_OPCOES: { value: RaioMetros; label: string }[] = [
  { value: 500, label: "500 m" },
  { value: 1000, label: "1 km" },
  { value: 2000, label: "2 km" },
];

export const PERIODO_MESES_OPCOES: { value: PeriodoMeses; label: string }[] = [
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
  { value: 24, label: "24 meses" },
  { value: 36, label: "36 meses" },
];

export const TIPO_OPCOES: { value: TipoImovelItbi; label: string }[] = [
  { value: "residencial", label: "Residencial (casas e apartamentos)" },
  { value: "apartamento", label: "Apartamentos" },
  { value: "casa", label: "Casas" },
  { value: "todos", label: "Todos os usos" },
];

export function getTipoLabel(tipo: TipoImovelItbi): string {
  return TIPO_OPCOES.find((t) => t.value === tipo)?.label ?? tipo;
}

export const FINANCIAMENTO_ROTULOS: { id: "mcmv" | "sfh" | "outros" | "semFinanciamento"; label: string; cor: string }[] = [
  { id: "mcmv", label: "Minha Casa Minha Vida", cor: "#1d4ed8" }, // blue-700
  { id: "sfh", label: "SFH", cor: "#38bdf8" }, // sky-400
  { id: "outros", label: "Outros", cor: "#94a3b8" }, // slate-400
  { id: "semFinanciamento", label: "À vista / sem financiamento", cor: "#e2e8f0" }, // slate-200
];

export const ENDERECO_MIN = 5;
export const ENDERECO_MAX = 200;

export const PRECISAO_LABELS: Record<PrecisaoGeocodificacao, { label: string; aproximado: boolean }> = {
  rooftop: { label: "no número", aproximado: false },
  rua: { label: "na rua", aproximado: false },
  cep: { label: "pelo CEP", aproximado: true },
  bairro: { label: "pelo bairro", aproximado: true },
};

// URL dos tiles configuravel (politica de uso do OSM: trocar por provedor
// comercial so pela variavel, se o uso crescer).
export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_ATRIBUICAO =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

// ---------- Faixas de preco/m2 (cor dos pontos no mapa) ----------
// Relativas a propria amostra: abaixo da faixa tipica (< p25), metade de
// baixo (p25-mediana), metade de cima (mediana-p75), acima (> p75).
// Escala sequencial de azuis (claro = mais barato); sem area = cinza.

export interface FaixaPreco {
  id: string;
  cor: string;
  label: string;
}

export const COR_SEM_PRECO = "#94a3b8"; // slate-400

export function montarFaixas(p25: number | null, mediana: number | null, p75: number | null): FaixaPreco[] | null {
  if (p25 === null || mediana === null || p75 === null) return null;
  return [
    { id: "f1", cor: "#bae6fd", label: `até ${formatMoeda(p25)}` }, // sky-200
    { id: "f2", cor: "#38bdf8", label: `${formatMoeda(p25)} – ${formatMoeda(mediana)}` }, // sky-400
    { id: "f3", cor: "#2563eb", label: `${formatMoeda(mediana)} – ${formatMoeda(p75)}` }, // blue-600
    { id: "f4", cor: "#1e3a8a", label: `acima de ${formatMoeda(p75)}` }, // blue-900
  ];
}

export function corDoPreco(
  precoM2: number | null,
  p25: number | null,
  mediana: number | null,
  p75: number | null,
): string {
  const faixas = montarFaixas(p25, mediana, p75);
  if (precoM2 === null || !faixas) return COR_SEM_PRECO;
  if (precoM2 < (p25 as number)) return faixas[0].cor;
  if (precoM2 < (mediana as number)) return faixas[1].cor;
  if (precoM2 <= (p75 as number)) return faixas[2].cor;
  return faixas[3].cor;
}

// ---------- Formatadores ----------

const decimalFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatArea(area: number | null): string {
  return area === null ? "—" : `${decimalFormatter.format(area)} m²`;
}

export function formatPrecoM2(valor: number | null): string {
  return valor === null ? "—" : `${formatMoeda(valor)}/m²`;
}

export function formatDistancia(metros: number): string {
  if (metros >= 1000) return `${decimalFormatter.format(metros / 1000)} km`;
  return `${formatNumero(Math.round(metros))} m`;
}

export function formatRaio(metros: number): string {
  return RAIO_OPCOES.find((r) => r.value === metros)?.label ?? formatDistancia(metros);
}

// Data da transacao/parametro: "YYYY-MM-DD" sem passar por Date; ISO
// completo cai no formatador com fuso local.
export function formatDataTransacao(valor: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? formatDateOnlyBr(valor) : formatDataIso(valor);
}

export function formatEnderecoTransacao(t: { logradouro: string; numero: string | null }): string {
  return t.numero ? `${t.logradouro}, ${t.numero}` : t.logradouro;
}
