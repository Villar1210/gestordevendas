// src/features/bii/components/VgvPorMesChart.tsx
// VGV ganho por mes (recharts). So roda no navegador: a pagina importa este
// componente via next/dynamic({ ssr: false }) - o ResponsiveContainer mede
// o elemento pai, o que nao existe no servidor.
"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMesCurto, formatMesLongo, formatMilhoes, formatMoeda, formatNumero } from "../constants";
import type { PainelVendasResponse } from "../types";

interface VgvPorMesChartProps {
  dados: PainelVendasResponse["vgvPorMes"];
  mesParcial: string | null; // YYYY-MM do mes que ainda nao terminou
}

// blue-600 / blue-700 (mes parcial destacado) / slate-200 / slate-500
const COR_BARRA = "#2563eb";
const COR_PARCIAL = "#1d4ed8";
const COR_GRADE = "#e2e8f0";
const COR_EIXO = "#64748b";

interface PontoGrafico {
  mes: string;
  rotulo: string;
  vgv: number;
  ganhos: number;
}

function TooltipVgv({ active, payload }: { active?: boolean; payload?: { payload: PontoGrafico }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold capitalize text-slate-800">{formatMesLongo(p.mes)}</p>
      <p className="text-slate-600">VGV: {formatMoeda(p.vgv)}</p>
      <p className="text-slate-600">
        {formatNumero(p.ganhos)} {p.ganhos === 1 ? "venda" : "vendas"}
      </p>
    </div>
  );
}

// Marcas "redondas" no eixo Y (0; 0,5; 1; 1,5 mi...) em vez de max/4.
function calcularTicks(max: number): number[] {
  if (max <= 0) return [0];
  const bruto = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  const ticks: number[] = [];
  for (let v = 0; v < max + passo; v += passo) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export default function VgvPorMesChart({ dados, mesParcial }: VgvPorMesChartProps) {
  const pontos: PontoGrafico[] = dados.map((d) => ({
    ...d,
    rotulo: `${formatMesCurto(d.mes)}${d.mes === mesParcial ? "*" : ""}`,
  }));
  const ticks = calcularTicks(Math.max(0, ...pontos.map((p) => p.vgv)));
  const resumoTexto = pontos
    .map((p) => `${formatMesLongo(p.mes)}: ${formatMoeda(p.vgv)}`)
    .join("; ");

  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label={`VGV ganho por mês. ${resumoTexto}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pontos} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={COR_GRADE} />
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
              tick={{ fill: COR_EIXO, fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, ticks[ticks.length - 1] || 1]}
              ticks={ticks}
              tickFormatter={(v: number) => formatMilhoes(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: COR_EIXO, fontSize: 11 }}
              width={48}
              allowDecimals
            />
            <Tooltip content={<TooltipVgv />} cursor={{ fill: "#eff6ff" }} />
            <Bar dataKey="vgv" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
              {pontos.map((p) => (
                <Cell key={p.mes} fill={p.mes === mesParcial ? COR_PARCIAL : COR_BARRA} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer select-none hover:text-slate-700">Ver valores em tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[280px] text-left">
            <thead className="text-slate-500">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">Mês</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">VGV</th>
                <th scope="col" className="py-1 text-right font-medium">Vendas</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {pontos.map((p) => (
                <tr key={p.mes} className="border-t border-slate-100">
                  <td className="py-1 pr-3 capitalize">{formatMesLongo(p.mes)}{p.mes === mesParcial ? " (parcial)" : ""}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{formatMoeda(p.vgv)}</td>
                  <td className="py-1 text-right tabular-nums">{formatNumero(p.ganhos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
