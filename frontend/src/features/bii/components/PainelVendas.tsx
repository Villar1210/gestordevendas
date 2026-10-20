// src/features/bii/components/PainelVendas.tsx
// Aba "Painel de Vendas" do BII: filtros, KPIs, funil, motivos de perda,
// VGV por mes, ranking de corretores e leads por origem.
"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, History, Loader2, RotateCw } from "lucide-react";
import { useBiiPainelStore } from "../store/useBiiPainelStore";
import { useBiiPainelIntegration } from "../hooks/useBiiPainelIntegration";
import {
  FILTROS_PADRAO,
  formatDataIso,
  formatDateOnly,
  formatDateOnlyBr,
  formatDias,
  formatMoeda,
  formatMoedaCompacta,
  formatNumero,
  formatPct,
  parseDateOnly,
} from "../constants";
import type { PainelVendasResponse } from "../types";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import { FunilChart, encontrarGargalo } from "./FunilChart";
import { KpiCard, variacaoDias, variacaoPontos, variacaoRelativa } from "./KpiCard";
import { MotivosPerda } from "./MotivosPerda";
import { PainelFiltros } from "./PainelFiltros";
import { PorOrigem } from "./PorOrigem";
import { RankingCorretores, RankingOrdem, useRankingOrdenado, type OrdemRanking } from "./RankingCorretores";

// Recharts mede o DOM: so no navegador.
const VgvPorMesChart = dynamic(() => import("./VgvPorMesChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-label="Carregando gráfico" />
    </div>
  ),
});

// Mes do periodo que ainda nao terminou (ultimo mes, se "ate" nao for o
// ultimo dia dele). Marcado com * no grafico.
function calcularMesParcial(ate: string): string | null {
  const data = parseDateOnly(ate);
  if (!data) return null;
  const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  return data.getDate() < ultimoDia ? ate.slice(0, 7) : null;
}

function semDados(d: PainelVendasResponse): boolean {
  return (
    d.resumo.leadsNovos === 0 &&
    d.resumo.ganhos === 0 &&
    d.resumo.perdidos === 0 &&
    d.funil.every((e) => e.entradas === 0)
  );
}

export function PainelVendas() {
  const dados = useBiiPainelStore((s) => s.dados);
  const isLoading = useBiiPainelStore((s) => s.isLoading);
  const erro = useBiiPainelStore((s) => s.erro);
  const filtrosAplicados = useBiiPainelStore((s) => s.filtrosAplicados);
  const { loadPainel } = useBiiPainelIntegration();
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    loadPainel(filtrosAplicados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { ordem, setOrdem, ordenado } = useRankingOrdenado(dados?.ranking ?? []);

  return (
    <div className="space-y-4">
      <PainelFiltros onAplicar={loadPainel} desabilitado={isLoading} />

      {isLoading && !dados ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm">Carregando painel...</p>
        </div>
      ) : erro ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-white px-4 py-12 text-center" role="alert">
          <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Não foi possível carregar o painel.</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">{erro}</p>
          </div>
          <button
            type="button"
            onClick={() => loadPainel(filtrosAplicados)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      ) : dados ? (
        <div className={`space-y-4 transition-opacity ${isLoading ? "pointer-events-none opacity-60" : ""}`} aria-busy={isLoading}>
          <PeriodoEHistorico dados={dados} atualizando={isLoading} />
          {semDados(dados) ? (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <EmptyState
                titulo="Nenhum card encontrado com esses filtros."
                texto="Tente outro período, outro pipeline ou remova os filtros de corretor e origem."
                acao={{ label: "Limpar filtros", onClick: () => loadPainel(FILTROS_PADRAO) }}
              />
            </div>
          ) : (
            <PainelConteudo dados={dados} ordem={ordem} setOrdem={setOrdem} rankingOrdenado={ordenado} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function PeriodoEHistorico({ dados, atualizando }: { dados: PainelVendasResponse; atualizando: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
        <p>
          Período: <span className="font-medium text-slate-700">{formatDateOnlyBr(dados.periodo.de)}</span> a{" "}
          <span className="font-medium text-slate-700">{formatDateOnlyBr(dados.periodo.ate)}</span>
          {atualizando && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-blue-600" aria-label="Atualizando" />}
        </p>
        {dados.historicoDesde && (
          <p className="flex items-center gap-1">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Histórico registrado desde {formatDataIso(dados.historicoDesde)}
          </p>
        )}
      </div>
      {!dados.historicoDesde && (
        <div className="flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="note">
          <History className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            O histórico de etapas começa a ser registrado a partir da implantação do BII — o funil e os ganhos aparecem
            conforme os leads forem movidos no Kanban.
          </p>
        </div>
      )}
    </div>
  );
}

interface PainelConteudoProps {
  dados: PainelVendasResponse;
  ordem: OrdemRanking;
  setOrdem: (ordem: OrdemRanking) => void;
  rankingOrdenado: PainelVendasResponse["ranking"];
}

function PainelConteudo({ dados, ordem, setOrdem, rankingOrdenado }: PainelConteudoProps) {
  const { resumo: r, comparativo: c } = dados;
  const gargalo = encontrarGargalo(dados.funil);
  const mesParcial = calcularMesParcial(dados.periodo.ate);
  const hoje = formatDateOnly(new Date());

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Leads novos"
          valor={formatNumero(r.leadsNovos)}
          variacao={variacaoRelativa(r.leadsNovos, c.leadsNovos)}
        />
        <KpiCard
          label="Vendas (ganhos)"
          valor={formatNumero(r.ganhos)}
          sub={`${formatNumero(r.perdidos)} ${r.perdidos === 1 ? "perdido" : "perdidos"}`}
          variacao={variacaoRelativa(r.ganhos, c.ganhos)}
        />
        <KpiCard
          label="Conversão lead → venda"
          valor={formatPct(r.conversaoPct)}
          variacao={variacaoPontos(r.conversaoPct, c.conversaoPct)}
        />
        <KpiCard
          label="VGV ganho"
          valor={formatMoedaCompacta(r.vgvGanho)}
          valorCompleto={formatMoeda(r.vgvGanho)}
          variacao={variacaoRelativa(r.vgvGanho, c.vgvGanho)}
        />
        <KpiCard
          label="Ticket médio"
          valor={r.ticketMedio === null ? "—" : formatMoedaCompacta(r.ticketMedio)}
          valorCompleto={r.ticketMedio === null ? undefined : formatMoeda(r.ticketMedio)}
          variacao={variacaoRelativa(r.ticketMedio, c.ticketMedio)}
        />
        <KpiCard
          label="Ciclo médio"
          valor={formatDias(r.cicloMedioDias)}
          sub={r.cicloMedianoDias !== null ? `mediana ${formatDias(r.cicloMedianoDias)}` : undefined}
          variacao={variacaoDias(r.cicloMedioDias, c.cicloMedioDias)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          titulo="Funil por etapa"
          fonteDetalhe="histórico de etapas"
          dica="Quantos cards entraram em cada etapa no período e a conversão para a etapa seguinte."
          rodape={
            gargalo ? (
              <>
                Gargalo do período:{" "}
                <b className="font-semibold text-slate-700">
                  {gargalo.de} → {gargalo.para} ({formatPct(gargalo.pct)})
                </b>
              </>
            ) : undefined
          }
        >
          <FunilChart funil={dados.funil} />
        </ChartCard>

        <ChartCard
          titulo="Motivos de perda"
          dica={`${formatNumero(r.perdidos)} ${r.perdidos === 1 ? "card perdido" : "cards perdidos"} no período (entraram em "Repique").`}
        >
          <MotivosPerda motivos={dados.motivosPerda} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="VGV ganho por mês"
          dica="Soma do valor dos cards ganhos, em R$ milhões. Eixo começa em zero."
          rodape={
            mesParcial ? `* ${formatDateOnlyBr(dados.periodo.ate)}${dados.periodo.ate === hoje ? " (hoje)" : ""}: mês parcial.` : undefined
          }
        >
          <VgvPorMesChart dados={dados.vgvPorMes} mesParcial={mesParcial} />
        </ChartCard>

        <ChartCard
          titulo="Ranking de corretores"
          dica="Leads novos, vendas e VGV de cada corretor no período."
          acoes={<RankingOrdem ordem={ordem} onChange={setOrdem} />}
        >
          <RankingCorretores ranking={rankingOrdenado} />
        </ChartCard>
      </div>

      <ChartCard titulo="Leads por origem" dica="De onde vieram os leads novos do período e quanto cada origem converteu.">
        <PorOrigem porOrigem={dados.porOrigem} />
      </ChartCard>
    </>
  );
}
