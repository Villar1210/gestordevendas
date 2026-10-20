// src/features/bii/components/KpiCard.tsx
// Indicador do painel: valor, rotulo e variacao contra o periodo anterior.
// A cor da variacao segue o significado, nao a direcao: para o ciclo de
// venda, subir e ruim (vermelho) e descer e bom (verde).
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatDecimal1, formatNumero } from "../constants";
import { SourceBadge } from "./SourceBadge";

export interface Variacao {
  texto: string;
  direcao: "up" | "down" | "flat";
  tom: "bom" | "ruim" | "neutro";
}

interface KpiCardProps {
  label: string;
  valor: string;
  valorCompleto?: string; // tooltip/leitor de tela quando o valor e compacto
  sub?: string;
  variacao: Variacao | null;
}

const TOM_CLASSE: Record<Variacao["tom"], string> = {
  bom: "text-green-700",
  ruim: "text-red-700",
  neutro: "text-slate-500",
};

export function KpiCard({ label, valor, valorCompleto, sub, variacao }: KpiCardProps) {
  const Icone = variacao?.direcao === "up" ? ArrowUpRight : variacao?.direcao === "down" ? ArrowDownRight : Minus;
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-xs leading-tight text-slate-500">{label}</p>
        <SourceBadge />
      </div>
      <p
        className="mt-1.5 truncate text-xl font-semibold text-blue-700 sm:text-2xl"
        title={valorCompleto ?? valor}
        aria-label={valorCompleto ? `${label}: ${valorCompleto}` : undefined}
      >
        {valor}
      </p>
      {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      <p className={`mt-1 flex items-center gap-1 text-xs ${variacao ? TOM_CLASSE[variacao.tom] : "text-slate-400"}`}>
        {variacao ? (
          <>
            <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{variacao.texto}</span>
          </>
        ) : (
          <span>sem base de comparação</span>
        )}
      </p>
    </div>
  );
}

// ---------- Calculo das variacoes ----------

const LIMIAR_ESTAVEL_PCT = 0.5;

// Variacao relativa (%): contagens e valores em reais.
export function variacaoRelativa(atual: number | null, anterior: number | null, maiorEhMelhor = true): Variacao | null {
  if (atual === null || anterior === null || anterior === 0) return null;
  const pct = ((atual - anterior) / anterior) * 100;
  if (Math.abs(pct) < LIMIAR_ESTAVEL_PCT) return { texto: "estável vs. anterior", direcao: "flat", tom: "neutro" };
  const subiu = pct > 0;
  return {
    texto: `${subiu ? "+" : "−"}${formatDecimal1(Math.abs(pct))}% vs. anterior`,
    direcao: subiu ? "up" : "down",
    tom: subiu === maiorEhMelhor ? "bom" : "ruim",
  };
}

// Diferenca em pontos percentuais (conversao).
export function variacaoPontos(atual: number | null, anterior: number | null): Variacao | null {
  if (atual === null || anterior === null) return null;
  const diff = atual - anterior;
  if (Math.abs(diff) < 0.05) return { texto: "estável vs. anterior", direcao: "flat", tom: "neutro" };
  const subiu = diff > 0;
  return {
    texto: `${subiu ? "+" : "−"}${formatDecimal1(Math.abs(diff))} p.p. vs. anterior`,
    direcao: subiu ? "up" : "down",
    tom: subiu ? "bom" : "ruim",
  };
}

// Diferenca em dias (ciclo): subir e PIOR.
export function variacaoDias(atual: number | null, anterior: number | null): Variacao | null {
  if (atual === null || anterior === null) return null;
  const diff = Math.round(atual) - Math.round(anterior);
  if (diff === 0) return { texto: "estável vs. anterior", direcao: "flat", tom: "neutro" };
  const subiu = diff > 0;
  const abs = Math.abs(diff);
  return {
    texto: `${subiu ? "+" : "−"}${formatNumero(abs)} ${abs === 1 ? "dia" : "dias"} (${subiu ? "pior" : "melhor"})`,
    direcao: subiu ? "up" : "down",
    tom: subiu ? "ruim" : "bom",
  };
}
