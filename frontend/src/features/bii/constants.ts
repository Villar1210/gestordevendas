// src/features/bii/constants.ts
// Rotulos, abas, presets de periodo e formatadores pt-BR do BII.
import type { PainelFiltrosState, PeriodoPreset } from "./types";

// Abas como rotas reais (link compartilhavel, botao voltar funciona).
// href null = ainda "em breve". exato = so ativa na rota exata (o Painel
// mora em /dashboard/bii, prefixo de todas as outras).
export const BII_ABAS: { id: string; label: string; href: string | null; exato?: boolean }[] = [
  { id: "vendas", label: "Painel de Vendas", href: "/dashboard/bii", exato: true },
  { id: "endereco", label: "Análise por Endereço", href: "/dashboard/bii/endereco" },
  { id: "concorrentes", label: "Concorrentes", href: "/dashboard/bii/concorrentes" },
  { id: "viabilidade", label: "Viabilidade", href: null },
  { id: "historico", label: "Histórico", href: "/dashboard/bii/historico" },
];

export const PERIODO_PRESETS: { value: PeriodoPreset; label: string }[] = [
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
  { value: "personalizado", label: "Personalizado" },
];

// Mesmo limite do backend (400 acima disso).
export const PERIODO_MAXIMO_MESES = 24;

export const FILTROS_PADRAO: PainelFiltrosState = {
  preset: "6",
  de: "",
  ate: "",
  pipelineId: "",
  corretorId: "",
  origem: "",
};

// Card.origem -> rotulo amigavel. Origem desconhecida cai no valor cru.
const ORIGEM_LABELS: Record<string, string> = {
  manual: "Manual",
  webhook: "Webhook / formulário",
  site: "Site",
  roleta_online: "Roleta Online",
  vivi_repique: "VIVI (repique)",
  captura_auto_vivi: "VIVI (captura automática)",
};

export function getOrigemLabel(origem: string): string {
  return ORIGEM_LABELS[origem] ?? origem;
}

// ---------- Datas "date-only" (YYYY-MM-DD) ----------
// Sempre pelos componentes LOCAIS - nunca toISOString() (converteria para
// UTC e voltaria um dia no Brasil; ver "bug sistemico de fuso horario" no
// CLAUDE.md).

export function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

// "2026-10-19" -> "19/10/2026" (sem passar por Date, imune a fuso).
export function formatDateOnlyBr(value: string): string {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

// Periodo de um preset: de N meses atras ate hoje.
export function periodoDoPreset(meses: number, hoje = new Date()): { de: string; ate: string } {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - meses, hoje.getDate());
  return { de: formatDateOnly(inicio), ate: formatDateOnly(hoje) };
}

// Valida o periodo personalizado; devolve mensagem de erro ou null.
export function validarPeriodo(de: string, ate: string): string | null {
  const dataDe = parseDateOnly(de);
  const dataAte = parseDateOnly(ate);
  if (!dataDe || !dataAte) return "Informe as duas datas do período.";
  if (dataDe > dataAte) return "A data inicial precisa ser anterior à data final.";
  const limite = new Date(dataDe.getFullYear(), dataDe.getMonth() + PERIODO_MAXIMO_MESES, dataDe.getDate());
  if (dataAte > limite) return `O período pode ter no máximo ${PERIODO_MAXIMO_MESES} meses.`;
  return null;
}

// ---------- Formatadores pt-BR ----------

const moedaFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const numeroFormatter = new Intl.NumberFormat("pt-BR");
const decimal1Formatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const compacto1Formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const compacto2Formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const mesFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const mesAnoFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dataFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function formatMoeda(valor: number): string {
  return moedaFormatter.format(valor);
}

// Moeda compacta, no estilo do mercado: "R$ 11,9 mi", "R$ 272 mil".
export function formatMoedaCompacta(valor: number): string {
  const abs = Math.abs(valor);
  const sinal = valor < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sinal}R$ ${compacto1Formatter.format(abs / 1_000_000_000)} bi`;
  if (abs >= 1_000_000) return `${sinal}R$ ${compacto1Formatter.format(abs / 1_000_000)} mi`;
  if (abs >= 10_000) return `${sinal}R$ ${numeroFormatter.format(Math.round(abs / 1_000))} mil`;
  return moedaFormatter.format(valor);
}

// Eixo do grafico de VGV: so o numero em milhoes ("1,4").
export function formatMilhoes(valor: number): string {
  return compacto2Formatter.format(valor / 1_000_000);
}

export function formatNumero(valor: number): string {
  return numeroFormatter.format(valor);
}

export function formatPct(valor: number | null): string {
  return valor === null ? "—" : `${decimal1Formatter.format(valor)}%`;
}

export function formatDecimal1(valor: number): string {
  return decimal1Formatter.format(valor);
}

export function formatDias(valor: number | null): string {
  if (valor === null) return "—";
  const arredondado = Math.round(valor);
  return `${numeroFormatter.format(arredondado)} ${arredondado === 1 ? "dia" : "dias"}`;
}

// "2026-05" -> "mai"
export function formatMesCurto(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return mesFormatter.format(new Date(y, m - 1, 1)).replace(".", "");
}

// "2026-05" -> "maio de 2026"
export function formatMesLongo(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return mesAnoFormatter.format(new Date(y, m - 1, 1));
}

// ISO completo (com horario) -> "19/10/2026" no fuso local.
export function formatDataIso(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dataFormatter.format(date);
}
