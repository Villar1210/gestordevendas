// src/features/bii/components/PorOrigem.tsx
// Leads, vendas e conversao por origem do lead (Card.origem).
import { Share2 } from "lucide-react";
import { formatNumero, formatPct, getOrigemLabel } from "../constants";
import type { PainelVendasResponse } from "../types";
import { EmptyState } from "./EmptyState";

export function PorOrigem({ porOrigem }: { porOrigem: PainelVendasResponse["porOrigem"] }) {
  const maxLeads = Math.max(0, ...porOrigem.map((o) => o.leads));
  if (porOrigem.length === 0) {
    return <EmptyState compacto icon={Share2} titulo="Nenhum lead novo no período." />;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[320px] text-left text-sm">
        <caption className="sr-only">Leads por origem no período</caption>
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-slate-100">
            <th scope="col" className="py-2 pr-3 font-medium">Origem</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Leads</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Vendas</th>
            <th scope="col" className="py-2 text-right font-medium">Conversão</th>
          </tr>
        </thead>
        <tbody>
          {porOrigem.map((o) => (
            <tr key={o.origem} className="border-b border-slate-50 last:border-0">
              <td className="py-2 pr-3">
                <p className="font-medium text-slate-800">{getOrigemLabel(o.origem)}</p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${maxLeads > 0 ? (o.leads / maxLeads) * 100 : 0}%` }}
                  />
                </div>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatNumero(o.leads)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatNumero(o.ganhos)}</td>
              <td className="py-2 text-right tabular-nums text-slate-700">{formatPct(o.conversaoPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
