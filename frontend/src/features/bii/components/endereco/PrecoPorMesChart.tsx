// R$/m2 mediano (linha) + quantidade de transacoes (barras) por mes, no raio.
// So no navegador (ResponsiveContainer mede o pai): importado via
// next/dynamic({ ssr: false }).
"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMesCurto, formatMesLongo, formatMoeda, formatNumero } from "../../constants";
import type { AnaliseEnderecoResponse } from "../../types-endereco";

interface PrecoPorMesChartProps {
  dados: AnaliseEnderecoResponse["porMes"];
}

const COR_LINHA = "#1d4ed8"; // blue-700
const COR_BARRA = "#cbd5e1"; // slate-300 (contexto, nao destaque)
const COR_GRADE = "#e2e8f0";
const COR_EIXO = "#64748b";

interface Ponto {
  mes: string;
  rotulo: string;
  transacoes: number;
  precoM2Mediano: number | null;
}

function TooltipMes({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold capitalize text-slate-800">{formatMesLongo(p.mes)}</p>
      <p className="text-slate-600">
        R$/m² mediano: {p.precoM2Mediano === null ? "sem base" : formatMoeda(p.precoM2Mediano)}
      </p>
      <p className="text-slate-600">
        {formatNumero(p.transacoes)} {p.transacoes === 1 ? "transação" : "transações"}
      </p>
    </div>
  );
}

function formatMilhar(valor: number): string {
  return valor >= 1000 ? `${formatNumero(Math.round(valor / 100) / 10)}k` : formatNumero(valor);
}

export default function PrecoPorMesChart({ dados }: PrecoPorMesChartProps) {
  const pontos: Ponto[] = dados.map((d) => ({ ...d, rotulo: formatMesCurto(d.mes) }));
  const resumoTexto = pontos
    .map(
      (p) =>
        `${formatMesLongo(p.mes)}: ${p.precoM2Mediano === null ? "sem preço" : formatMoeda(p.precoM2Mediano) + " por m²"}, ${p.transacoes} transações`,
    )
    .join("; ");

  return (
    <div role="img" aria-label={`Preço por m² mediano e transações por mês. ${resumoTexto}`} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={pontos} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={COR_GRADE} />
          <XAxis
            dataKey="rotulo"
            tickLine={false}
            axisLine={{ stroke: COR_GRADE }}
            tick={{ fill: COR_EIXO, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            yAxisId="preco"
            domain={["auto", "auto"]}
            tickFormatter={formatMilhar}
            tickLine={false}
            axisLine={false}
            tick={{ fill: COR_EIXO, fontSize: 11 }}
            width={40}
          />
          <YAxis
            yAxisId="qtd"
            orientation="right"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: COR_EIXO, fontSize: 11 }}
            width={28}
          />
          <Tooltip content={<TooltipMes />} cursor={{ fill: "#f1f5f9" }} />
          <Bar yAxisId="qtd" dataKey="transacoes" fill={COR_BARRA} radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line
            yAxisId="preco"
            dataKey="precoM2Mediano"
            stroke={COR_LINHA}
            strokeWidth={2.5}
            dot={{ r: 3, fill: COR_LINHA, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
