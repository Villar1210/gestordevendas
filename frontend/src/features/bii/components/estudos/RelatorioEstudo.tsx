// Relatorio do Estudo de terreno (BII Fatia 5) - usado na tela do dashboard e
// na versao para impressao. So mostra o snapshot salvo (nada e recalculado).
// ITBI fica SEMPRE lado a lado (nunca em %): bases diferentes - ver contrato.
"use client";

import dynamic from "next/dynamic";
import { FileText, Info, Loader2, MapPin, TriangleAlert } from "lucide-react";
import { formatDataIso, formatMoeda, formatNumero } from "../../constants";
import { formatDataTransacao, formatPrecoM2, formatRaio } from "../../constants-endereco";
import { COR_CONCORRENTE } from "../../constants-concorrentes";
import type { ClassePosicao, Estudo, Posicao } from "../../types-estudo";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import { KpiCard } from "../KpiCard";
import { SourceBadge } from "../SourceBadge";
import { ConcorrentesNoRaio } from "../concorrentes/ConcorrentesNoRaio";
import { ParametrosCard, Pill, Resultado } from "../viabilidade/ViabilidadePage";
import { ResultadoFinanceiroCard, SITUACAO_FINANCEIRA } from "../financeiro/ResultadoFinanceiroCard";

function Carregando({ texto }: { texto: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-label={texto} />
    </div>
  );
}

// Leaflet e recharts usam window: so no navegador.
const MapaAnalise = dynamic(() => import("../endereco/MapaAnalise"), { ssr: false, loading: () => <Carregando texto="Carregando mapa" /> });
const PrecoPorMesChart = dynamic(() => import("../endereco/PrecoPorMesChart"), {
  ssr: false,
  loading: () => (
    <div className="h-64">
      <Carregando texto="Carregando gráfico" />
    </div>
  ),
});

export const POSICAO: Record<ClassePosicao, { label: string; classe: string }> = {
  abaixo: { label: "Abaixo", classe: "border-green-200 bg-green-50 text-green-700" },
  alinhado: { label: "Alinhado", classe: "border-slate-200 bg-slate-100 text-slate-700" },
  acima: { label: "Acima", classe: "border-amber-200 bg-amber-50 text-amber-700" },
};

const FRASE_POSICAO: Record<ClassePosicao, string> = {
  abaixo: "abaixo da concorrência",
  alinhado: "alinhado à concorrência",
  acima: "acima da concorrência",
};

function formatDiferenca(p: Posicao): string {
  const v = Math.abs(p.diferencaPercentual).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${p.diferencaPercentual > 0 ? "+" : p.diferencaPercentual < 0 ? "−" : ""}${v}%`;
}

function PosicaoPill({ p }: { p: Posicao | null }) {
  if (!p) return <span className="text-xs text-slate-400">sem concorrentes</span>;
  const s = POSICAO[p.classe];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Pill classe={s.classe}>{s.label}</Pill>
      <span className="text-xs text-slate-600">{formatDiferenca(p)}</span>
    </span>
  );
}

const SECAO = "print:break-inside-avoid";

export function RelatorioEstudo({ estudo }: { estudo: Estudo }) {
  const { analise, resumoExecutivo: re, viabilidade } = estudo;
  const fonteDetalhe = analise.fonte?.atualizadoAte ? `até ${formatDataTransacao(analise.fonte.atualizadoAte)}` : undefined;
  const temPorMes = analise.porMes?.some((m) => m.transacoes > 0) ?? false;

  return (
    <article className="space-y-4" aria-label={`Estudo ${estudo.nome}`}>
      {/* Cabecalho */}
      <header className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${SECAO}`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Estudo de terreno
        </p>
        <h2 className="mt-1 break-words text-xl font-semibold text-slate-900">{estudo.nome}</h2>
        <p className="mt-2 flex min-w-0 items-start gap-1.5 text-sm text-slate-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
          <span className="break-words">{analise.endereco.formatado}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Raio {formatRaio(analise.parametros.raioMetros)} · ITBI de {formatDataTransacao(analise.parametros.de)} a{" "}
          {formatDataTransacao(analise.parametros.ate)} · análise de mercado de {formatDataIso(analise.criadoEm)} · estudo
          criado em {formatDataIso(estudo.criadoEm)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SourceBadge fonte="ITBI" detalhe={fonteDetalhe} />
          <SourceBadge fonte="Manual" />
          <SourceBadge fonte="Oficial" />
        </div>
      </header>

      {/* Resumo executivo */}
      <section className={`space-y-3 ${SECAO}`} aria-labelledby="estudo-resumo">
        <h3 id="estudo-resumo" className="text-sm font-semibold text-slate-800">
          Resumo executivo
        </h3>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="R$/m² mediano (ITBI)"
            valor={re.itbi.precoM2Mediano === null ? "—" : formatMoeda(re.itbi.precoM2Mediano)}
            sub={
              re.itbi.precoM2P25 !== null && re.itbi.precoM2P75 !== null
                ? `${formatMoeda(re.itbi.precoM2P25)} – ${formatMoeda(re.itbi.precoM2P75)} · ${formatNumero(re.itbi.transacoes)} transações`
                : `${formatNumero(re.itbi.transacoes)} transações`
            }
            fonte="ITBI"
          />
          <KpiCard
            label="Concorrentes no raio"
            valor={re.concorrentes === null ? "—" : formatNumero(re.concorrentes.quantidade)}
            sub={
              re.concorrentes?.precoM2Mediano != null
                ? `R$/m² de tabela mediano ${formatMoeda(re.concorrentes.precoM2Mediano)}`
                : re.concorrentes === null
                  ? "análise sem concorrentes"
                  : "sem R$/m² para comparar"
            }
            fonte="Manual"
          />
          <KpiCard
            label="Tipologias sem ressalva"
            valor={`${re.viabilidade.ok} de ${re.viabilidade.tipologias} ok`}
            sub={`${re.viabilidade.atencao} com atenção · ${re.viabilidade.fora} fora · ${re.viabilidade.enquadramMcmv} no MCMV`}
            fonte="Oficial"
          />
          <KpiCard
            label="R$/m² médio das tipologias"
            fonte={null}
            valor={formatMoeda(re.tipologias.precoM2Medio)}
            sub={re.tipologias.posicaoMedia ? `${FRASE_POSICAO[re.tipologias.posicaoMedia.classe]} (${formatDiferenca(re.tipologias.posicaoMedia)})` : "sem concorrentes para comparar"}
          />
        </div>
        {re.financeiro && (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard label="VGV" fonte={null} valor={formatMoeda(re.financeiro.vgvTotal)} sub={re.financeiro.permutaPercentual > 0 ? `${re.financeiro.permutaPercentual.toLocaleString("pt-BR")}% em permuta` : "sem permuta"} />
            <KpiCard
              label={re.financeiro.permutaPercentual > 0 ? "Margem sobre o VGV vendável" : "Margem sobre o VGV"}
              fonte={null}
              valor={`${re.financeiro.margemVgvPercentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
              sub={`${SITUACAO_FINANCEIRA[re.financeiro.situacao].label} · desejada ${re.financeiro.margemAlvoPercentual.toLocaleString("pt-BR")}%`}
            />
            <KpiCard label={re.financeiro.lucro >= 0 ? "Lucro estimado" : "Prejuízo estimado"} fonte={null} valor={formatMoeda(Math.abs(re.financeiro.lucro))} />
            <KpiCard
              label="Terreno máximo (dinheiro)"
              fonte={null}
              valor={re.financeiro.valorMaximoTerreno === null ? "Não fecha" : formatMoeda(re.financeiro.valorMaximoTerreno)}
              sub={re.financeiro.valorCompraTerreno > 0 ? `pedido: ${formatMoeda(re.financeiro.valorCompraTerreno)}` : "sem valor de compra informado"}
            />
          </div>
        )}
        {estudo.destaques.length > 0 && (
          <ul className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            {estudo.destaques.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
        {estudo.alertas.length > 0 && (
          <ul className="space-y-2" aria-label="Alertas do estudo">
            {estudo.alertas.map((a) => (
              <li key={a.codigo} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{a.mensagem}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Conclusao do Administrador (texto puro) */}
      <ChartCard titulo="Conclusão" fonte={null} className={SECAO} dica="Opinião de quem fez o estudo (não é calculada pelo BII).">
        {estudo.conclusao ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{estudo.conclusao}</p>
        ) : (
          <p className="text-sm text-slate-400">Sem conclusão registrada.</p>
        )}
      </ChartCard>

      {/* Posicionamento de preco */}
      <ChartCard
        titulo="Posicionamento de preço"
        fonte="Manual"
        className={SECAO}
        dica="Contra os concorrentes: mesma base (preço de tabela ÷ área privativa), alinhado = até 5% para cima ou para baixo. O ITBI aparece só ao lado, sem %, porque a base é outra (valor pago ÷ área construída do IPTU)."
      >
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium sm:px-2">Tipologia</th>
                <th className="px-2 py-2 font-medium">R$/m² (tabela)</th>
                <th className="px-2 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    vs. concorrentes <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COR_CONCORRENTE }} aria-hidden="true" />
                  </span>
                </th>
                <th className="px-4 py-2 font-medium sm:px-2">ITBI no raio (mediana e faixa típica)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estudo.posicionamento.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 font-medium text-slate-800 sm:px-2">{p.descricao}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">{formatPrecoM2(p.precoM2)}</td>
                  <td className="px-2 py-2.5">
                    <PosicaoPill p={p.concorrentes} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700 sm:px-2">
                    {p.itbi.precoM2Mediano === null ? "—" : formatPrecoM2(p.itbi.precoM2Mediano)}
                    {p.itbi.precoM2P25 !== null && p.itbi.precoM2P75 !== null && (
                      <span className="block text-xs text-slate-500">
                        {formatPrecoM2(p.itbi.precoM2P25)} – {formatPrecoM2(p.itbi.precoM2P75)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Viabilidade financeira (Fatia 7; estudos antigos nao tem) */}
      {estudo.financeiro ? (
        <div className={SECAO}>
          <ResultadoFinanceiroCard r={estudo.financeiro} titulo="Viabilidade financeira" />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 print:hidden">
          Este estudo foi salvo sem viabilidade financeira. Para incluir, crie um estudo novo e marque “Incluir viabilidade financeira”.
        </p>
      )}

      {/* Viabilidade */}
      <div className={SECAO}>
        <Resultado r={viabilidade} />
      </div>

      {/* Mapa */}
      <ChartCard
        titulo={`Mapa do entorno (raio ${formatRaio(analise.parametros.raioMetros)})`}
        fonte="ITBI"
        fonteDetalhe={fonteDetalhe}
        className={SECAO}
        dica="Pontos: transações do ITBI no raio. Marcador roxo: concorrente cadastrado."
      >
        <div className="relative isolate -mx-4 h-[320px] overflow-hidden sm:mx-0 sm:h-[400px] sm:rounded-xl print:h-[360px]">
          <MapaAnalise analise={analise} />
        </div>
      </ChartCard>

      <div className={SECAO}>
        <ConcorrentesNoRaio
          concorrentes={analise.concorrentes}
          precoM2ItbiMediano={analise.resumo.precoM2Mediano}
          raioTexto={formatRaio(analise.parametros.raioMetros)}
          salva
        />
      </div>

      <ChartCard titulo="R$/m² mediano por mês (ITBI)" fonte="ITBI" fonteDetalhe={fonteDetalhe} className={SECAO}>
        {temPorMes ? <PrecoPorMesChart dados={analise.porMes} /> : <EmptyState compacto titulo="Sem transações por mês no período" />}
      </ChartCard>

      <div className={SECAO}>
        <ParametrosCard p={viabilidade.parametros} />
      </div>

      <section className={`rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 sm:p-5 ${SECAO}`} aria-label="Notas de método">
        <p className="flex items-center gap-1.5 font-semibold text-slate-600">
          <Info className="h-3.5 w-3.5" aria-hidden="true" /> Notas de método
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Este estudo é uma foto do dia em que foi salvo: mudanças posteriores no ITBI, nos concorrentes ou nas regras oficiais não o alteram.</li>
          <li>
            ITBI: {analise.fonte?.nome ?? "ITBI — Prefeitura de São Paulo"}, guias pagas (valor declarado). {analise.fonte?.observacao}
          </li>
          <li>Concorrentes: cadastrados pela própria empresa (preço anunciado “a partir de”, área privativa).</li>
          <li>{viabilidade.observacao}</li>
          {estudo.financeiro && <li>{estudo.financeiro.observacao} Custo de obra digitado; CUB-SP só como referência.</li>}
          <li>Mapa: © OpenStreetMap contributors.</li>
        </ul>
      </section>
    </article>
  );
}
