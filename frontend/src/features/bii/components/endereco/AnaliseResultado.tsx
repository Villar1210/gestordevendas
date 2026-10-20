// Resultado de uma analise por endereco (nova ou aberta do Historico):
// cabecalho com o endereco localizado, avisos de cobertura, mapa, KPIs,
// grafico por mes e tabela da amostra.
"use client";

import dynamic from "next/dynamic";
import { Building2, Info, Loader2, MapPin, TriangleAlert } from "lucide-react";
import { formatDataIso, formatMoeda, formatNumero } from "../../constants";
import {
  COR_SEM_PRECO,
  formatArea,
  formatDataTransacao,
  formatPrecoM2,
  formatRaio,
  getTipoLabel,
  montarFaixas,
  PRECISAO_LABELS,
} from "../../constants-endereco";
import type { AnaliseEnderecoResponse } from "../../types-endereco";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import { KpiCard } from "../KpiCard";
import { SourceBadge } from "../SourceBadge";
import { AmostraTable } from "./AmostraTable";
import { FinanciamentoCard, PlantaCard } from "./PlantaFinanciamento";

function Carregando({ texto }: { texto: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-label={texto} />
    </div>
  );
}

// Leaflet usa window: so no navegador.
const MapaAnalise = dynamic(() => import("./MapaAnalise"), {
  ssr: false,
  loading: () => <Carregando texto="Carregando mapa" />,
});

const PrecoPorMesChart = dynamic(() => import("./PrecoPorMesChart"), {
  ssr: false,
  loading: () => (
    <div className="h-64">
      <Carregando texto="Carregando gráfico" />
    </div>
  ),
});

function Alerta({ tom, children }: { tom: "atencao" | "info"; children: React.ReactNode }) {
  const Icone = tom === "atencao" ? TriangleAlert : Info;
  return (
    <div
      role={tom === "atencao" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${
        tom === "atencao" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-800"
      }`}
    >
      <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function formatCoord(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

interface AnaliseResultadoProps {
  analise: AnaliseEnderecoResponse;
  salvaEm?: string; // quando aberta do Historico: mostra "foto do dia"
}

export function AnaliseResultado({ analise, salvaEm }: AnaliseResultadoProps) {
  const { endereco, parametros, cobertura, resumo, porMes, amostra, fonte } = analise;
  const precisao = PRECISAO_LABELS[endereco.precisao] ?? { label: endereco.precisao, aproximado: true };
  const faixas = montarFaixas(resumo.precoM2P25, resumo.precoM2Mediano, resumo.precoM2P75);
  const semTransacoes = resumo.transacoes === 0 && amostra.length === 0;
  const filtrosUso = [
    parametros.tipo ? getTipoLabel(parametros.tipo).toLowerCase() : null,
    parametros.somenteCompraVenda === true ? "só compra e venda" : parametros.somenteCompraVenda === false ? "todas as naturezas" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const temPorMes = porMes.some((m) => m.transacoes > 0);
  const filtroArea =
    parametros.areaMin !== null || parametros.areaMax !== null
      ? ` · área ${parametros.areaMin !== null ? `de ${formatArea(parametros.areaMin)}` : ""}${
          parametros.areaMin !== null && parametros.areaMax !== null ? " " : ""
        }${parametros.areaMax !== null ? `até ${formatArea(parametros.areaMax)}` : ""}`
      : "";
  const fonteDetalhe = fonte.atualizadoAte ? `até ${formatDataTransacao(fonte.atualizadoAte)}` : undefined;

  return (
    <div className="space-y-4">
      {/* Endereco localizado */}
      <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-slate-800">{endereco.formatado}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Localizado {precisao.label} ({formatCoord(endereco.lat)}; {formatCoord(endereco.lng)}) · raio{" "}
            {formatRaio(parametros.raioMetros)} · {parametros.meses} meses ({formatDataTransacao(parametros.de)} a{" "}
            {formatDataTransacao(parametros.ate)}){filtroArea}
            {filtrosUso ? ` · ${filtrosUso}` : ""}
          </p>
          {endereco.digitado !== endereco.formatado && (
            <p className="mt-0.5 break-words text-xs text-slate-400">Digitado: {endereco.digitado}</p>
          )}
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <SourceBadge fonte="ITBI" detalhe={fonteDetalhe} />
          {salvaEm && <span className="text-[11px] text-slate-400">salva em {formatDataIso(salvaEm)}</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:hidden">
        <SourceBadge fonte="ITBI" detalhe={fonteDetalhe} />
        {salvaEm && <span className="text-[11px] text-slate-400">salva em {formatDataIso(salvaEm)}</span>}
      </div>

      {salvaEm && (
        <Alerta tom="info">
          Esta é a análise como foi salva em {formatDataIso(salvaEm)}: os números são a foto daquele dia. Para dados de
          hoje, faça uma nova análise do mesmo endereço.
        </Alerta>
      )}

      {precisao.aproximado && (
        <Alerta tom="atencao">
          <b>Localização aproximada.</b> O endereço foi encontrado só {precisao.label}, então o centro do raio pode estar
          deslocado. Inclua o número e o bairro para um ponto mais preciso.
        </Alerta>
      )}

      {cobertura.semLocalizacao > 0 && (
        <Alerta tom="atencao">
          <b>
            {formatNumero(cobertura.semLocalizacao)}{" "}
            {cobertura.semLocalizacao === 1 ? "transação do ITBI desta região ainda não foi" : "transações do ITBI desta região ainda não foram"}{" "}
            geocodificadas
          </b>{" "}
          e não aparecem no mapa nem nos números abaixo (de {formatNumero(cobertura.transacoesNoPeriodoNaRegiao)} no
          período). O Super Usuário pode geocodificar a região pelo prefixo de CEP (ex.: 03277) na tela de dados públicos
          do BII.
        </Alerta>
      )}

      {/* Vendas na planta (destaque para quem lanca HIS) + financiamento */}
      {(analise.planta || analise.financiamento) && (
        <div className="grid gap-4 lg:grid-cols-5">
          {analise.planta && (
            <div className="lg:col-span-3">
              <PlantaCard planta={analise.planta} fonteDetalhe={fonteDetalhe} />
            </div>
          )}
          {analise.financiamento && (
            <div className={analise.planta ? "lg:col-span-2" : "lg:col-span-5"}>
              <FinanciamentoCard financiamento={analise.financiamento} fonteDetalhe={fonteDetalhe} />
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Transações no raio" valor={formatNumero(resumo.transacoes)} sub="guias de ITBI pagas" fonte="ITBI" />
        <KpiCard
          label="Preço/m² mediano"
          valor={resumo.precoM2Mediano === null ? "—" : formatMoeda(resumo.precoM2Mediano)}
          sub="mediana da amostra"
          fonte="ITBI"
        />
        <div className="col-span-2 sm:col-span-1 xl:col-span-2">
          <KpiCard
            label="Faixa típica do m² (p25–p75)"
            valor={
              resumo.precoM2P25 === null || resumo.precoM2P75 === null
                ? "—"
                : `${formatMoeda(resumo.precoM2P25)} – ${formatMoeda(resumo.precoM2P75)}`
            }
            sub="metade das vendas ficou aqui"
            fonte="ITBI"
          />
        </div>
        <KpiCard
          label="Valor mediano"
          valor={resumo.valorMediano === null ? "—" : formatMoeda(resumo.valorMediano)}
          sub="declarado na guia"
          fonte="ITBI"
        />
        <KpiCard label="Área mediana" valor={formatArea(resumo.areaMediana)} sub="área construída" fonte="ITBI" />
      </div>
      {fonte.observacao && (
        <p className="-mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{fonte.observacao}</span>
        </p>
      )}

      {/* Mapa */}
      <ChartCard
        titulo={`Mapa do entorno (raio ${formatRaio(parametros.raioMetros)})`}
        fonte="ITBI"
        fonteDetalhe={fonteDetalhe}
        dica="Cada ponto é uma transação no raio. Clique num ponto para ver data, valor, área e distância."
      >
        <div className="relative isolate -mx-4 h-[320px] overflow-hidden sm:mx-0 sm:h-[420px] sm:rounded-xl lg:h-[480px]">
          <MapaAnalise analise={analise} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600" aria-label="Legenda do mapa">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-2.5 rounded-t-full rounded-b-sm bg-slate-900" aria-hidden="true" />
            Endereço analisado
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border border-dashed border-blue-600" aria-hidden="true" />
            Raio {formatRaio(parametros.raioMetros)}
          </li>
          {faixas?.map((f) => (
            <li key={f.id} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: f.cor }} aria-hidden="true" />
              {f.label}/m²
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: COR_SEM_PRECO }} aria-hidden="true" />
            sem área informada
          </li>
        </ul>
      </ChartCard>

      {semTransacoes ? (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            icon={Building2}
            titulo="Nenhuma transação localizada neste raio"
            texto={
              cobertura.semLocalizacao > 0
                ? "Há transações do ITBI na região que ainda não foram geocodificadas (veja o aviso acima). Tente também um raio maior ou um período mais longo."
                : "Tente um raio maior, um período mais longo ou retire o filtro de área."
            }
          />
        </section>
      ) : (
        <div className="space-y-4">
          <ChartCard
            titulo="Preço/m² mediano por mês"
            fonte="ITBI"
            fonteDetalhe={fonteDetalhe}
            dica="Linha: R$/m² mediano (eixo à esquerda, não começa em zero). Barras: quantidade de transações (eixo à direita)."
          >
            {temPorMes ? (
              <PrecoPorMesChart dados={porMes} />
            ) : (
              <EmptyState compacto titulo="Sem transações por mês no período" />
            )}
          </ChartCard>
          <ChartCard
            titulo={`Amostra (${formatNumero(amostra.length)} ${amostra.length === 1 ? "transação" : "transações"})`}
            fonte="ITBI"
            fonteDetalhe={fonteDetalhe}
            dica="As mais próximas primeiro (até 200). Clique no título da coluna para ordenar."
            rodape={`Preço/m² = valor ÷ área construída. Valores abaixo de ${formatPrecoM2(500)} ou acima de ${formatPrecoM2(60000)} ficam fora da mediana e da faixa típica.`}
          >
            <AmostraTable analise={analise} />
          </ChartCard>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Fonte: {fonte.nome} — guias de ITBI pagas (base aberta).{" "}
        {fonte.atualizadoAte ? `Dado mais recente: ${formatDataTransacao(fonte.atualizadoAte)}. ` : ""}
        Valores declarados na guia; não inclui vendas sem ITBI. Mapa: © OpenStreetMap contributors.
      </p>
    </div>
  );
}
