// src/features/bii/components/MotivosPerda.tsx
// Motivos de perda (cards que entraram em "Repique"): barras horizontais
// neutras (slate) - perda nao e destaque nem status.
import { ThumbsDown } from "lucide-react";
import { formatNumero, formatPct } from "../constants";
import type { PainelVendasResponse } from "../types";
import { EmptyState } from "./EmptyState";

export function MotivosPerda({ motivos }: { motivos: PainelVendasResponse["motivosPerda"] }) {
  const max = Math.max(0, ...motivos.map((m) => m.quantidade));
  if (motivos.length === 0 || max === 0) {
    return <EmptyState compacto icon={ThumbsDown} titulo="Nenhum card perdido no período." />;
  }

  return (
    <ul className="space-y-3">
      {motivos.map((m) => (
        <li key={m.motivo}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-slate-700" title={m.rotulo}>
              {m.rotulo}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">
              {formatNumero(m.quantidade)} · {formatPct(m.pct)}
            </span>
          </div>
          <div
            className="mt-1 h-1.5 rounded-full bg-slate-100"
            role="meter"
            aria-label={m.rotulo}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={m.pct}
            aria-valuetext={`${formatNumero(m.quantidade)} cards, ${formatPct(m.pct)}`}
          >
            <div className="h-full rounded-full bg-slate-400" style={{ width: `${(m.quantidade / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
