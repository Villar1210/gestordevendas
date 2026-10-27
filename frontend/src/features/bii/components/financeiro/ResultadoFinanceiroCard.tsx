// Quadro do resultado final do empreendimento (BII Fatia 7): selo de
// situação, 4 números principais (VGV, lucro, margem, valor máximo do
// terreno), DRE simples e avisos. Usado na aba Viabilidade, no relatório do
// estudo e na versão para impressão.
import { TriangleAlert } from "lucide-react";
import { formatMoeda, formatPct } from "../../constants";
import type { ResultadoFinanceiro, SituacaoFinanceira } from "../../types-financeiro";
import { ChartCard } from "../ChartCard";
import { mesReferenciaBr } from "./PremissasFinanceirasCampos";

export const SITUACAO_FINANCEIRA: Record<SituacaoFinanceira, { label: string; classe: string; texto: string }> = {
  viavel: { label: "Viável", classe: "border-green-200 bg-green-50 text-green-700", texto: "a margem chega à desejada" },
  apertado: { label: "Apertado", classe: "border-amber-200 bg-amber-50 text-amber-700", texto: "tem lucro, mas abaixo da margem desejada" },
  inviavel: { label: "Inviável", classe: "border-red-200 bg-red-50 text-red-700", texto: "os custos passam da receita" },
};

const br = (n: number, casas = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const negativo = (v: number) => (v === 0 ? formatMoeda(0) : `− ${formatMoeda(v)}`);
// percentual digitado pelo usuario: sem ",0" sobrando (10% e nao 10,0%)
const pctP = (v: number) => `${br(v, 2)}%`;

function Linha({ rotulo, valor, detalhe, forte, sinal }: { rotulo: string; valor: string; detalhe?: string; forte?: boolean; sinal?: "neg" | "pos" }) {
  return (
    <tr className={forte ? "border-t border-slate-200" : ""}>
      <td className={`py-1.5 pr-3 ${forte ? "font-semibold text-slate-800" : "text-slate-600"}`}>
        {rotulo}
        {detalhe && <span className="block text-[11px] font-normal text-slate-500">{detalhe}</span>}
      </td>
      <td
        className={`whitespace-nowrap py-1.5 text-right tabular-nums ${forte ? "font-semibold" : ""} ${
          sinal === "neg" ? "text-red-700" : sinal === "pos" ? "text-green-700" : "text-slate-800"
        }`}
      >
        {valor}
      </td>
    </tr>
  );
}

function Numero({ rotulo, valor, sub, destaque }: { rotulo: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${destaque ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[11px] font-medium text-slate-500">{rotulo}</p>
      <p className={`mt-0.5 break-words text-base font-semibold tabular-nums sm:text-lg ${destaque ? "text-blue-800" : "text-slate-800"}`}>{valor}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

export function ResultadoFinanceiroCard({ r, titulo = "Resultado financeiro" }: { r: ResultadoFinanceiro; titulo?: string }) {
  const s = SITUACAO_FINANCEIRA[r.resultado.situacao];
  const p = r.premissas;
  const alvo = p.margemAlvoPercentual;
  const permuta = p.terreno.permutaPercentual > 0;
  const baseMargem = permuta ? "Margem sobre o VGV vendável" : "Margem sobre o VGV";
  const cubCurto = r.referenciaCub.rotulo.split(" (")[0];
  const regime = p.comercial.impostoRegime === "outro" ? `${br(p.comercial.impostoPercentual, 2)}%` : p.comercial.impostoRegime === "ret1" ? "RET 1%" : "RET 4%";
  return (
    <ChartCard
      titulo={titulo}
      fonte={null}
      dica={`${r.areas.unidades} unidades · ${br(r.areas.privativaTotal)} m² privativos · ${br(r.areas.construida)} m² construídos (${br(r.areas.fatorEfetivo)} × privativa) · obra ${formatMoeda(p.obra.custoM2)}/m²`}
      acoes={
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.classe}`} title={s.texto}>
          {s.label}
        </span>
      }
      rodape={r.observacao}
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Numero rotulo="VGV" valor={formatMoeda(r.vgv.total)} sub={permuta ? `${formatMoeda(r.vgv.vendavel)} para vender` : undefined} />
        <Numero rotulo={r.resultado.lucro >= 0 ? "Lucro estimado" : "Prejuízo estimado"} valor={formatMoeda(Math.abs(r.resultado.lucro))} />
        <Numero rotulo={baseMargem} valor={formatPct(r.resultado.margemVgvPercentual)} sub={`desejada ${pctP(alvo)}`} />
        <Numero
          rotulo={`Terreno máximo para ${pctP(alvo)}`}
          valor={r.resultado.valorMaximoTerreno === null ? "Não fecha" : formatMoeda(r.resultado.valorMaximoTerreno)}
          sub={r.resultado.valorMaximoTerreno === null ? "nem com terreno de graça" : permuta ? `em dinheiro, além de ${pctP(p.terreno.permutaPercentual)} em permuta` : "em dinheiro"}
          destaque
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <table className="w-full text-sm">
          <tbody>
            <Linha rotulo="VGV total" valor={formatMoeda(r.vgv.total)} detalhe={r.tipologias.map((t) => `${t.quantidade} × ${t.descricao}`).join(" · ")} />
            {permuta && <Linha rotulo={`Permuta (${pctP(p.terreno.permutaPercentual)} do VGV em unidades)`} valor={negativo(r.vgv.permuta)} sinal="neg" />}
            {permuta && <Linha rotulo="VGV vendável" valor={formatMoeda(r.vgv.vendavel)} forte />}
            <Linha rotulo={`Imposto (${regime})`} valor={negativo(r.deducoes.imposto)} sinal="neg" />
            <Linha rotulo={`Comissão (${pctP(p.comercial.comissaoPercentual)})`} valor={negativo(r.deducoes.comissao)} sinal="neg" />
            <Linha rotulo={`Marketing (${pctP(p.comercial.marketingPercentual)})`} valor={negativo(r.deducoes.marketing)} sinal="neg" />
            <Linha rotulo="Receita líquida" valor={formatMoeda(r.receitaLiquida)} forte />
            <Linha
              rotulo="Terreno"
              valor={negativo(r.custos.terreno.total)}
              detalhe={r.custos.terreno.compra > 0 ? `compra ${formatMoeda(r.custos.terreno.compra)} + ITBI ${formatMoeda(r.custos.terreno.itbi)} + cartório ${formatMoeda(r.custos.terreno.escrituraRegistro)}` : "sem compra em dinheiro"}
              sinal="neg"
            />
            <Linha rotulo="Obra" valor={negativo(r.custos.obra)} detalhe={`${br(r.areas.construida)} m² × ${formatMoeda(p.obra.custoM2)}`} sinal="neg" />
            <Linha rotulo={`Indiretos (${pctP(p.obra.indiretosPercentual)} da obra)`} valor={negativo(r.custos.indiretos)} sinal="neg" />
            <Linha rotulo={`Contingência (${pctP(p.obra.contingenciaPercentual)} da obra)`} valor={negativo(r.custos.contingencia)} sinal="neg" />
            <Linha rotulo="Custo total" valor={formatMoeda(r.custos.total)} forte />
            <Linha
              rotulo={r.resultado.lucro >= 0 ? "Lucro" : "Prejuízo"}
              valor={formatMoeda(r.resultado.lucro)}
              forte
              sinal={r.resultado.lucro >= 0 ? "pos" : "neg"}
            />
          </tbody>
        </table>
        <dl className="grid h-fit grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <dt className="text-xs text-slate-500">Margem sobre o custo</dt>
          <dd className="text-right font-medium tabular-nums text-slate-800">{formatPct(r.resultado.margemCustoPercentual)}</dd>
          <dt className="text-xs text-slate-500">Peso do terreno no VGV{permuta ? " (com permuta)" : ""}</dt>
          <dd className="text-right font-medium tabular-nums text-slate-800">{formatPct(r.resultado.pesoTerrenoPercentual)}</dd>
          <dt className="text-xs text-slate-500">Custo total por m² privativo</dt>
          <dd className="text-right font-medium tabular-nums text-slate-800">{formatMoeda(r.resultado.custoM2Privativo)}</dd>
          <dt className="text-xs text-slate-500">Obra por m² privativo</dt>
          <dd className="text-right font-medium tabular-nums text-slate-800">{formatMoeda(r.resultado.custoObraM2Privativo)}</dd>
          <dt className="text-xs text-slate-500">
            {cubCurto} {mesReferenciaBr(r.referenciaCub.mesReferencia)}
          </dt>
          <dd className="text-right font-medium tabular-nums text-slate-800">
            {formatMoeda(r.referenciaCub.valorM2)}
            <span className="block text-[11px] font-normal text-slate-500">custo = {br(r.referenciaCub.razaoCustoCub)} × CUB</span>
          </dd>
        </dl>
      </div>

      {r.avisos.length > 0 && (
        <ul className="mt-4 space-y-2">
          {r.avisos.map((a, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
