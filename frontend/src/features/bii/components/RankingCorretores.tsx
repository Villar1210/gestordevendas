// src/features/bii/components/RankingCorretores.tsx
// Ranking de corretores do periodo. O backend ja ordena por VGV; os outros
// criterios (vendas, conversao) reordenam so na tela.
"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { formatMoeda, formatMoedaCompacta, formatNumero, formatPct } from "../constants";
import type { PainelVendasResponse } from "../types";
import { EmptyState } from "./EmptyState";

export type OrdemRanking = "vgv" | "ganhos" | "conversao";

const ORDENS: { value: OrdemRanking; label: string }[] = [
  { value: "vgv", label: "VGV" },
  { value: "ganhos", label: "Vendas" },
  { value: "conversao", label: "Conversão" },
];

export function RankingOrdem({ ordem, onChange }: { ordem: OrdemRanking; onChange: (o: OrdemRanking) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Ordenar ranking por">
      {ORDENS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={ordem === o.value}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            ordem === o.value ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useRankingOrdenado(ranking: PainelVendasResponse["ranking"]) {
  const [ordem, setOrdem] = useState<OrdemRanking>("vgv");
  const ordenado = useMemo(() => {
    if (ordem === "vgv") return ranking;
    return [...ranking].sort((a, b) =>
      ordem === "ganhos"
        ? b.ganhos - a.ganhos || b.vgv - a.vgv
        : (b.conversaoPct ?? -1) - (a.conversaoPct ?? -1) || b.ganhos - a.ganhos,
    );
  }, [ranking, ordem]);
  return { ordem, setOrdem, ordenado };
}

export function RankingCorretores({ ranking }: { ranking: PainelVendasResponse["ranking"] }) {
  const maxVgv = Math.max(0, ...ranking.map((r) => r.vgv));

  if (ranking.length === 0) {
    return <EmptyState compacto icon={Users} titulo="Nenhum corretor com leads no período." />;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[460px] text-left text-sm">
        <caption className="sr-only">Ranking de corretores no período</caption>
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-slate-100">
            <th scope="col" className="w-8 py-2 pr-2 font-medium">#</th>
            <th scope="col" className="py-2 pr-3 font-medium">Corretor</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Leads</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Vendas</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Conversão</th>
            <th scope="col" className="py-2 text-right font-medium">VGV</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.corretorId} className="border-b border-slate-50 last:border-0">
              <td className="py-2 pr-2 align-top">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    i < 3 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
              </td>
              <td className="py-2 pr-3">
                <p className="max-w-[12rem] truncate font-medium text-slate-800" title={r.nome}>
                  {r.nome}
                </p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${maxVgv > 0 ? (r.vgv / maxVgv) * 100 : 0}%` }}
                  />
                </div>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatNumero(r.leads)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatNumero(r.ganhos)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatPct(r.conversaoPct)}</td>
              <td className="py-2 text-right font-semibold tabular-nums text-slate-800" title={formatMoeda(r.vgv)}>
                {formatMoedaCompacta(r.vgv)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
