// Aba "Viabilidade" do BII (Fatia 4): para cada tipologia, categoria municipal
// (HIS-1, HIS-2, HMP), faixa do MCMV, renda necessaria estimada e avisos.
// O calculo e todo no backend (POST /bii/viabilidade); a tela so coleta e mostra.
// Fatia 7: "Resultado financeiro" (POST /bii/viabilidade-financeira) com as
// quantidades de cada tipologia, terreno (compra/permuta), obra e comercial.
"use client";

import { useEffect, useState } from "react";
import { Building, Calculator, Info, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { formatDateOnlyBr, formatMoeda, formatPct } from "../../constants";
import { formatPrecoM2 } from "../../constants-endereco";
import { listarConcorrentes } from "../../hooks/useBiiConcorrentesIntegration";
import { calcularViabilidade, carregarParametros, mensagemErroViabilidade } from "../../hooks/useBiiViabilidadeIntegration";
import { calcularFinanceiro, carregarParametrosFinanceiros } from "../../hooks/useBiiFinanceiroIntegration";
import type { ReferenciaCub, ResultadoFinanceiro } from "../../types-financeiro";
import { estadoFinanceiroInicial, lerEstadoFinanceiro, PremissasFinanceirasCampos } from "../financeiro/PremissasFinanceirasCampos";
import { ResultadoFinanceiroCard } from "../financeiro/ResultadoFinanceiroCard";
import type { Concorrente } from "../../types-concorrentes";
import type { ParametrosVigentes, ResultadoTipologia, Situacao, ViabilidadeResposta } from "../../types-viabilidade";
import { lerNumeroBr } from "../concorrentes/ConcorrenteForm";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import { SourceBadge } from "../SourceBadge";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50";
const LABEL = "text-xs font-medium text-slate-600";
const MAX_TIPOLOGIAS = 20;

export const SITUACAO: Record<Situacao, { label: string; classe: string }> = {
  ok: { label: "OK", classe: "border-green-200 bg-green-50 text-green-700" },
  atencao: { label: "Atenção", classe: "border-amber-200 bg-amber-50 text-amber-700" },
  fora: { label: "Fora", classe: "border-red-200 bg-red-50 text-red-700" },
};

const CATEGORIA_CLASSE: Record<string, string> = {
  HIS1: "border-green-100 bg-green-50 text-green-700",
  HIS2: "border-teal-100 bg-teal-50 text-teal-700",
  HMP: "border-slate-200 bg-slate-100 text-slate-700",
  MERCADO: "border-slate-200 bg-white text-slate-500",
};

interface Linha {
  chave: number;
  descricao: string;
  area: string;
  preco: string;
  qtd: string;
}

let seq = 1;
const nova = (d = "", a = "", p = "", q = ""): Linha => ({ chave: seq++, descricao: d, area: a, preco: p, qtd: q });

// quantidade de unidades: inteiro de 1 a 5.000 (null = invalido)
export function lerQuantidade(texto: string): number | null {
  const bruto = texto.trim();
  // ponto so como separador de milhar ("1.200"); "1.5" e invalido
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(bruto)) return null;
  const t = bruto.replace(/\./g, "");
  const n = Number(t);
  return n >= 1 && n <= 5000 ? n : null;
}
const br = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function Pill({ classe, children }: { classe: string; children: React.ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-semibold ${classe}`}>{children}</span>;
}

export function ViabilidadePage() {
  const [linhas, setLinhas] = useState<Linha[]>(() => [nova("2 dorm.", "40", "")]);
  const [entrada, setEntrada] = useState("20");
  const [prazo, setPrazo] = useState("420");
  const [comprometimento, setComprometimento] = useState("30");
  const [jurosFixo, setJurosFixo] = useState(false);
  const [juros, setJuros] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState<ViabilidadeResposta | null>(null);
  const [parametros, setParametros] = useState<ParametrosVigentes | null>(null);
  const [concorrentes, setConcorrentes] = useState<Concorrente[] | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [incluirFinanceiro, setIncluirFinanceiro] = useState(true);
  const [financeiro, setFinanceiro] = useState(estadoFinanceiroInicial);
  const [cub, setCub] = useState<ReferenciaCub | null>(null);
  const [resultadoFin, setResultadoFin] = useState<ResultadoFinanceiro | null>(null);

  useEffect(() => {
    carregarParametros().then(setParametros).catch(() => setParametros(null));
    carregarParametrosFinanceiros()
      .then((p) => setCub(p.cub))
      .catch(() => setCub(null));
  }, []);

  async function abrirConcorrentes() {
    setEscolhendo(true);
    if (concorrentes === null) {
      try {
        setConcorrentes(await listarConcorrentes());
      } catch {
        setConcorrentes([]);
      }
    }
  }

  function trazer(c: Concorrente) {
    setLinhas(c.tipologias.slice(0, MAX_TIPOLOGIAS).map((t) => nova(t.descricao, br(t.areaPrivativa), br(t.precoDe))));
    setEscolhendo(false);
    setResultado(null);
    setResultadoFin(null);
  }

  const setLinha = (chave: number, campo: "descricao" | "area" | "preco" | "qtd", v: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: v } : l)));

  async function calcular(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const tipologias: { descricao: string; areaPrivativa: number; preco: number }[] = [];
    for (const [i, l] of linhas.entries()) {
      const area = lerNumeroBr(l.area);
      const preco = lerNumeroBr(l.preco);
      if (typeof area !== "number" || area < 10 || area > 1000) return setErro(`Tipologia nº ${i + 1}: informe a área privativa entre 10 e 1.000 m².`);
      if (typeof preco !== "number" || preco < 10_000 || preco > 100_000_000) return setErro(`Tipologia nº ${i + 1}: informe o preço em reais (ex.: 269.000).`);
      tipologias.push({ descricao: l.descricao.trim() || `Tipologia ${i + 1}`, areaPrivativa: area, preco });
    }
    // o financeiro e independente: um erro nele nao impede o enquadramento
    const quantidades: number[] = [];
    let fin: ReturnType<typeof lerEstadoFinanceiro> | null = null;
    let erroFin: string | null = null;
    if (incluirFinanceiro) {
      for (const [i, l] of linhas.entries()) {
        const q = lerQuantidade(l.qtd);
        if (q === null) {
          erroFin = `Tipologia nº ${i + 1}: informe a quantidade de unidades (1 a 5.000) para o resultado financeiro.`;
          break;
        }
        quantidades.push(q);
      }
      if (!erroFin) {
        fin = lerEstadoFinanceiro(financeiro);
        if ("erro" in fin) {
          erroFin = fin.erro;
          fin = null;
        }
      }
    }
    const ent = lerNumeroBr(entrada);
    const pra = Number(prazo);
    const com = lerNumeroBr(comprometimento);
    const jur = jurosFixo ? lerNumeroBr(juros) : null;
    if (typeof ent !== "number" || ent > 90) return setErro("Entrada: use um percentual de 0 a 90.");
    if (typeof com !== "number" || com < 10 || com > 50) return setErro("Comprometimento da renda: use de 10% a 50%.");
    if (jurosFixo && (typeof jur !== "number" || jur > 30)) return setErro("Juros: informe a taxa ao ano, de 0 a 30%.");
    setCalculando(true);
    try {
      const [viab, resFin] = await Promise.allSettled([
        calcularViabilidade({
          tipologias,
          premissas: { entradaPercentual: ent, prazoMeses: pra, comprometimentoPercentual: com, jurosAnual: jurosFixo ? (jur as number) : null },
        }),
        fin && "premissas" in fin
          ? calcularFinanceiro({ tipologias: tipologias.map((t, i) => ({ ...t, quantidade: quantidades[i] })), premissas: fin.premissas })
          : Promise.resolve(null),
      ]);
      const erros: string[] = [];
      if (viab.status === "fulfilled") setResultado(viab.value);
      else {
        setResultado(null);
        erros.push(mensagemErroViabilidade(viab.reason));
      }
      if (resFin.status === "fulfilled") setResultadoFin(resFin.value);
      else {
        setResultadoFin(null);
        erros.push(`Resultado financeiro: ${mensagemErroViabilidade(resFin.reason)}`);
      }
      if (erroFin) {
        setResultadoFin(null);
        erros.push(`Resultado financeiro: ${erroFin}`);
      }
      if (erros.length) setErro(erros.join(" "));
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={calcular} noValidate className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">Viabilidade HIS/HMP e Minha Casa, Minha Vida</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
              Informe as tipologias do produto. O BII diz em que categoria da Prefeitura e em que faixa do MCMV cada uma se
              encaixa, a folga até o teto e a renda que o comprador precisa ter.
            </p>
          </div>
          <button
            type="button"
            onClick={abrirConcorrentes}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Building className="h-4 w-4" aria-hidden="true" /> Trazer de um concorrente
          </button>
        </div>

        {escolhendo && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {concorrentes === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-label="Carregando concorrentes" />
            ) : concorrentes.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhum concorrente cadastrado. Cadastre na aba Concorrentes.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Copiar as tipologias (preço “a partir de”) de:</span>
                {concorrentes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => trazer(c)}
                    className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50"
                  >
                    {c.nome}
                  </button>
                ))}
                <button type="button" onClick={() => setEscolhendo(false)} className="ml-auto text-xs text-slate-500 hover:text-slate-700">
                  Fechar
                </button>
              </div>
            )}
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {linhas.map((l, i) => (
            <li key={l.chave} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_9rem_6rem_auto] sm:items-end">
              <div className="col-span-2 sm:col-span-1">
                <label className={LABEL} htmlFor={`v-desc-${l.chave}`}>
                  Tipologia
                </label>
                <input id={`v-desc-${l.chave}`} className={`mt-1 ${INPUT}`} value={l.descricao} maxLength={100} placeholder="2 dorm. c/ varanda" onChange={(e) => setLinha(l.chave, "descricao", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor={`v-area-${l.chave}`}>
                  Área privativa (m²)
                </label>
                <input id={`v-area-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="decimal" value={l.area} placeholder="40" onChange={(e) => setLinha(l.chave, "area", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor={`v-preco-${l.chave}`}>
                  Preço (R$)
                </label>
                <input id={`v-preco-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="decimal" value={l.preco} placeholder="269.000" onChange={(e) => setLinha(l.chave, "preco", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor={`v-qtd-${l.chave}`}>
                  Unidades
                </label>
                <input id={`v-qtd-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="numeric" value={l.qtd} placeholder="80" onChange={(e) => setLinha(l.chave, "qtd", e.target.value)} />
              </div>
              <button
                type="button"
                disabled={linhas.length === 1}
                onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                className="justify-self-end self-end rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                aria-label={`Remover tipologia ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={linhas.length >= MAX_TIPOLOGIAS}
          onClick={() => setLinhas((ls) => [...ls, nova()])}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar tipologia
        </button>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-slate-700">Premissas do financiamento</legend>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={LABEL} htmlFor="v-entrada">
                Entrada (%)
              </label>
              <input id="v-entrada" className={`mt-1 ${INPUT}`} inputMode="decimal" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="v-prazo">
                Prazo
              </label>
              <select id="v-prazo" className={`mt-1 ${INPUT}`} value={prazo} onChange={(e) => setPrazo(e.target.value)}>
                {[420, 360, 300, 240, 180, 120].map((m) => (
                  <option key={m} value={m}>
                    {m / 12} anos ({m} meses)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="v-comp">
                Comprometimento da renda (%)
              </label>
              <input id="v-comp" className={`mt-1 ${INPUT}`} inputMode="decimal" value={comprometimento} onChange={(e) => setComprometimento(e.target.value)} />
            </div>
            <div>
              <span className={LABEL}>Juros ao ano</span>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={jurosFixo} onChange={(e) => setJurosFixo(e.target.checked)} />
                Usar taxa fixa
              </label>
              {jurosFixo ? (
                <input aria-label="Juros ao ano (%)" className={`mt-1 ${INPUT}`} inputMode="decimal" value={juros} placeholder="8,16" onChange={(e) => setJuros(e.target.value)} />
              ) : (
                <p className="mt-1 text-xs text-slate-500">Referência da faixa do MCMV em que a renda cair.</p>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-5 rounded-xl border border-slate-200 p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">Resultado financeiro do empreendimento</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={incluirFinanceiro} onChange={(e) => setIncluirFinanceiro(e.target.checked)} />
            Calcular VGV, custos, lucro e o valor máximo do terreno
          </label>
          {incluirFinanceiro && (
            <div className="mt-3">
              <PremissasFinanceirasCampos estado={financeiro} onChange={setFinanceiro} cub={cub} prefixo="vf" />
            </div>
          )}
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={calculando}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {calculando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Calculator className="h-4 w-4" aria-hidden="true" />}
            {calculando ? "Calculando..." : "Calcular"}
          </button>
          {erro && (
            <p role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}
        </div>
      </form>

      {resultadoFin && <ResultadoFinanceiroCard r={resultadoFin} />}

      {resultado ? <Resultado r={resultado} /> : (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState icon={Calculator} titulo="Preencha as tipologias e clique em Calcular" texto="Dica: use “Trazer de um concorrente” para checar em que faixa os lançamentos vizinhos se encaixam." />
        </section>
      )}

      {parametros && <ParametrosCard p={parametros} />}
    </div>
  );
}

export function Resultado({ r }: { r: ViabilidadeResposta }) {
  return (
    <ChartCard
      titulo="Enquadramento por tipologia"
      fonte="Oficial"
      dica={`Entrada ${formatPct(r.premissas.entradaPercentual)} · ${r.premissas.prazoMeses} meses · comprometimento ${formatPct(r.premissas.comprometimentoPercentual)} · juros ${r.premissas.jurosAnual === null ? "de referência por faixa" : `${br(r.premissas.jurosAnual)}% a.a.`}`}
      rodape={r.observacao}
    >
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium sm:px-2">Tipologia</th>
              <th className="px-2 py-2 font-medium">Preço</th>
              <th className="px-2 py-2 font-medium">R$/m²</th>
              <th className="px-2 py-2 font-medium">Municipal</th>
              <th className="px-2 py-2 font-medium">Folga até o teto</th>
              <th className="px-2 py-2 font-medium">MCMV</th>
              <th className="px-2 py-2 font-medium">Renda necessária</th>
              <th className="px-2 py-2 font-medium">Parcela</th>
              <th className="px-4 py-2 font-medium sm:px-2">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.resultados.map((t, i) => (
              <LinhaResultado key={i} t={t} />
            ))}
          </tbody>
        </table>
      </div>
      {r.resultados.some((t) => t.avisos.length > 0) && (
        <ul className="mt-4 space-y-2">
          {r.resultados.flatMap((t, i) =>
            t.avisos.map((a, j) => (
              <li key={`${i}-${j}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <b>{t.descricao}:</b> {a}
                </span>
              </li>
            )),
          )}
        </ul>
      )}
    </ChartCard>
  );
}

function LinhaResultado({ t }: { t: ResultadoTipologia }) {
  const s = SITUACAO[t.situacao];
  return (
    <tr className="align-top">
      <td className="px-4 py-2.5 sm:px-2">
        <p className="font-medium text-slate-800">{t.descricao}</p>
        <p className="text-xs text-slate-500">{br(t.areaPrivativa)} m²</p>
      </td>
      <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">{formatMoeda(t.preco)}</td>
      <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">{formatPrecoM2(t.precoM2)}</td>
      <td className="px-2 py-2.5">
        <Pill classe={CATEGORIA_CLASSE[t.municipal.categoria] ?? CATEGORIA_CLASSE.MERCADO}>{t.municipal.rotulo}</Pill>
        {t.municipal.teto !== null && <p className="mt-0.5 text-xs text-slate-500">teto {formatMoeda(t.municipal.teto)}</p>}
      </td>
      <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">
        {t.municipal.folga === null ? "—" : formatMoeda(t.municipal.folga)}
        {t.municipal.folgaPercentual !== null && <span className="block text-xs text-slate-500">{formatPct(t.municipal.folgaPercentual)} do teto</span>}
      </td>
      <td className="px-2 py-2.5">
        <Pill classe={t.mcmv.enquadra ? "border-violet-100 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500"}>{t.mcmv.rotuloFaixaPelaRenda}</Pill>
        {t.mcmv.tetoFaixaPelaRenda !== null && <p className="mt-0.5 text-xs text-slate-500">teto {formatMoeda(t.mcmv.tetoFaixaPelaRenda)}</p>}
        {!t.mcmv.enquadra && (
          <p className="mt-0.5 text-xs text-slate-500">
            {t.mcmv.faixaPeloPreco ? `preço cabe a partir da ${t.mcmv.faixaPeloPreco.replace("F", "Faixa ")}` : "preço acima do teto do MCMV"}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-2.5 font-medium text-slate-800">
        {formatMoeda(t.financiamento.rendaNecessaria)}
        <span className="block text-xs font-normal text-slate-500">
          {t.mcmv.rendaPeloPiso ? "piso da faixa · " : ""}juros {br(t.financiamento.jurosAnual)}% a.a.
        </span>
      </td>
      <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">
        {formatMoeda(t.financiamento.parcela)}
        <span className="block text-xs text-slate-500">financia {formatMoeda(t.financiamento.valorFinanciado)}</span>
      </td>
      <td className="px-4 py-2.5 sm:px-2">
        <Pill classe={s.classe}>{s.label}</Pill>
      </td>
    </tr>
  );
}

export function ParametrosCard({ p }: { p: ParametrosVigentes }) {
  return (
    <ChartCard titulo="Parâmetros vigentes" fonte="Oficial" dica={`Valores usados no cálculo em ${formatDateOnlyBr(p.dataReferencia)}.`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">Municipal — HIS/HMP</p>
          <p className="text-xs text-slate-500">{p.municipal.fonte}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 font-medium">Categoria</th>
                  <th className="py-1 font-medium">Renda familiar máx.</th>
                  <th className="py-1 font-medium">Teto de venda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {p.municipal.categorias.map((c) => (
                  <tr key={c.categoria}>
                    <td className="py-1.5 font-medium text-slate-700">{c.rotulo}</td>
                    <td className="py-1.5 text-slate-700">
                      {formatMoeda(c.rendaMax)} <span className="text-xs text-slate-500">({c.salariosMinimos} SM)</span>
                    </td>
                    <td className="py-1.5 text-slate-700">{c.tetoVenda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-slate-500">Salário mínimo de referência {formatMoeda(p.municipal.salarioMinimoRef)}.</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">Federal — Minha Casa, Minha Vida</p>
          <p className="text-xs text-slate-500">{p.mcmv.fonte}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 font-medium">Faixa</th>
                  <th className="py-1 font-medium">Renda bruta até</th>
                  <th className="py-1 font-medium">Teto do imóvel</th>
                  <th className="py-1 font-medium">Juros ref.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {p.mcmv.faixas.map((f) => (
                  <tr key={f.faixa}>
                    <td className="py-1.5 font-medium text-slate-700">{f.rotulo}</td>
                    <td className="py-1.5 text-slate-700">{formatMoeda(f.rendaMax)}</td>
                    <td className="py-1.5 text-slate-700">{formatMoeda(f.tetoImovel)}</td>
                    <td className="py-1.5 text-slate-700">{br(f.jurosReferenciaAnual)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {p.mcmv.observacao} Acima da Faixa 4: juros de referência {br(p.mcmv.jurosForaAnual)}% a.a. (SBPE).
            </span>
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <SourceBadge fonte="Oficial" /> A correspondência entre HIS/HMP e as faixas do MCMV é aproximada: um produto pode caber
        numa e não na outra.
      </p>
    </ChartCard>
  );
}
