// src/features/bii/components/FunilChart.tsx
// Funil por etapa: barras centralizadas proporcionais as entradas, com a
// conversao para a etapa seguinte. HTML/CSS (nao SVG fixo) para caber em
// qualquer largura; tabela equivalente para leitor de tela.
import { formatNumero, formatPct } from "../constants";
import type { PainelVendasResponse } from "../types";
import { EmptyState } from "./EmptyState";
import { Filter } from "lucide-react";

// Tons de azul do mais escuro (topo) ao mais claro; ultima etapa (venda) em verde.
const TONS = ["bg-blue-700", "bg-blue-600", "bg-blue-500", "bg-blue-400", "bg-blue-300", "bg-blue-200"];
const TEXTO_CLARO = new Set(["bg-blue-700", "bg-blue-600", "bg-blue-500"]);

export function FunilChart({ funil }: { funil: PainelVendasResponse["funil"] }) {
  const max = Math.max(0, ...funil.map((e) => e.entradas));
  if (funil.length === 0 || max === 0) {
    return (
      <EmptyState
        compacto
        icon={Filter}
        titulo="Nenhuma movimentação de etapa no período."
        texto="O funil aparece conforme os cards forem movidos no Kanban."
      />
    );
  }

  return (
    <div>
      <ol className="space-y-2" aria-hidden="true">
        {funil.map((etapa, i) => {
          const ultima = i === funil.length - 1;
          const tom = ultima ? "bg-green-600" : TONS[Math.min(i, TONS.length - 1)];
          const claro = ultima || TEXTO_CLARO.has(tom);
          const largura = Math.max((etapa.entradas / max) * 100, 8);
          return (
            <li key={etapa.stageId} className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_3.75rem] items-center gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem]">
              <span className="truncate text-right text-xs text-slate-600" title={etapa.nome}>
                {etapa.nome}
              </span>
              <div className="flex h-8 justify-center">
                <div
                  className={`flex h-full items-center justify-center rounded-lg text-xs font-semibold ${tom} ${
                    claro ? "text-white" : "text-slate-800"
                  }`}
                  style={{ width: `${largura}%`, minWidth: "2.25rem" }}
                >
                  {formatNumero(etapa.entradas)}
                </div>
              </div>
              <span className="text-xs text-slate-500">
                {etapa.conversaoProximaPct !== null ? `↓ ${formatPct(etapa.conversaoProximaPct)}` : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {/* sr-only no wrapper: em <table> o width:1px nao vale e a tabela vaza a largura da pagina */}
      <div className="sr-only">
        <table>
          <caption>Funil por etapa no período</caption>
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col">Entradas</th>
              <th scope="col">Conversão para a próxima etapa</th>
            </tr>
          </thead>
          <tbody>
            {funil.map((etapa) => (
              <tr key={etapa.stageId}>
                <th scope="row">{etapa.nome}</th>
                <td>{formatNumero(etapa.entradas)}</td>
                <td>{etapa.conversaoProximaPct !== null ? formatPct(etapa.conversaoProximaPct) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Etapa com a menor conversao para a seguinte (gargalo), ou null.
export function encontrarGargalo(funil: PainelVendasResponse["funil"]): { de: string; para: string; pct: number } | null {
  let gargalo: { de: string; para: string; pct: number } | null = null;
  funil.forEach((etapa, i) => {
    const proxima = funil[i + 1];
    if (!proxima || etapa.conversaoProximaPct === null || etapa.entradas === 0) return;
    if (!gargalo || etapa.conversaoProximaPct < gargalo.pct) {
      gargalo = { de: etapa.nome, para: proxima.nome, pct: etapa.conversaoProximaPct };
    }
  });
  return gargalo;
}
