// Campos das premissas da Viabilidade financeira (BII Fatia 7): terreno
// (compra e/ou permuta), obra (R$/m², área construída ou fator), comercial
// (imposto, comissão, marketing) e margem desejada. Usado na aba Viabilidade
// e no assistente do Estudo de terreno. Só coleta: a conta é no backend.
"use client";

import { Info } from "lucide-react";
import { formatMoeda } from "../../constants";
import type { PremissasFinanceirasInput, ReferenciaCub, RegimeImposto } from "../../types-financeiro";
import { lerNumeroBr } from "../concorrentes/ConcorrenteForm";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50";
const LABEL = "text-xs font-medium text-slate-600";

export interface EstadoFinanceiro {
  valorCompra: string;
  itbi: string;
  escritura: string;
  usarPermuta: boolean;
  permuta: string;
  custoM2: string;
  modoArea: "fator" | "area";
  fator: string;
  areaConstruida: string;
  indiretos: string;
  contingencia: string;
  regime: RegimeImposto;
  impostoOutro: string;
  comissao: string;
  marketing: string;
  margemAlvo: string;
}

export function estadoFinanceiroInicial(): EstadoFinanceiro {
  return {
    valorCompra: "",
    itbi: "3",
    escritura: "1",
    usarPermuta: false,
    permuta: "",
    custoM2: "",
    modoArea: "fator",
    fator: "1,6",
    areaConstruida: "",
    indiretos: "10",
    contingencia: "5",
    regime: "ret4",
    impostoOutro: "",
    comissao: "5",
    marketing: "3",
    margemAlvo: "15",
  };
}

const num = (t: string) => lerNumeroBr(t);

function faixa(texto: string, min: number, max: number): number | null {
  const v = num(texto);
  return typeof v === "number" && v >= min && v <= max ? v : null;
}

// Converte os textos em premissas, com a mesma faixa de valores do backend.
export function lerEstadoFinanceiro(e: EstadoFinanceiro): { premissas: PremissasFinanceirasInput } | { erro: string } {
  const custoM2 = faixa(e.custoM2, 500, 20_000);
  if (custoM2 === null) return { erro: "Custo de obra: informe o R$/m² de área construída, entre R$ 500 e R$ 20.000." };
  const compraTxt = e.valorCompra.trim();
  const compra = compraTxt ? faixa(compraTxt, 0, 2_000_000_000) : 0;
  if (compra === null) return { erro: "Terreno: informe o valor de compra em reais (ex.: 3.000.000) ou deixe em branco." };
  const itbi = faixa(e.itbi, 0, 10);
  const escritura = faixa(e.escritura, 0, 10);
  if (itbi === null || escritura === null) return { erro: "ITBI e escritura/registro: use de 0% a 10%." };
  const permuta = e.usarPermuta ? faixa(e.permuta, 0, 60) : 0;
  if (permuta === null) return { erro: "Permuta: informe de 0% a 60% do VGV." };
  let areaConstruida: number | null = null;
  let fator: number | undefined;
  if (e.modoArea === "area") {
    areaConstruida = faixa(e.areaConstruida, 1, 2_000_000);
    if (areaConstruida === null) return { erro: "Área construída: informe o total em m²." };
  } else {
    const f = faixa(e.fator, 1, 3);
    if (f === null) return { erro: "Fator de área construída: use de 1,0 a 3,0." };
    fator = f;
  }
  const indiretos = faixa(e.indiretos, 0, 50);
  const contingencia = faixa(e.contingencia, 0, 30);
  if (indiretos === null) return { erro: "Custos indiretos: use de 0% a 50% da obra." };
  if (contingencia === null) return { erro: "Contingência: use de 0% a 30% da obra." };
  let impostoPercentual: number | undefined;
  if (e.regime === "outro") {
    const v = faixa(e.impostoOutro, 0, 30);
    if (v === null) return { erro: "Imposto: informe o percentual do VGV, de 0% a 30%." };
    impostoPercentual = v;
  }
  const comissao = faixa(e.comissao, 0, 15);
  const marketing = faixa(e.marketing, 0, 15);
  if (comissao === null || marketing === null) return { erro: "Comissão e marketing: use de 0% a 15% do VGV." };
  const margem = faixa(e.margemAlvo, 0, 60);
  if (margem === null) return { erro: "Margem desejada: use de 0% a 60% do VGV." };
  return {
    premissas: {
      terreno: { valorCompra: compra, itbiPercentual: itbi, escrituraRegistroPercentual: escritura, permutaPercentual: permuta },
      obra: {
        custoM2,
        areaConstruida,
        ...(fator !== undefined ? { fatorAreaConstruida: fator } : {}),
        indiretosPercentual: indiretos,
        contingenciaPercentual: contingencia,
      },
      comercial: {
        impostoRegime: e.regime,
        ...(impostoPercentual !== undefined ? { impostoPercentual } : {}),
        comissaoPercentual: comissao,
        marketingPercentual: marketing,
      },
      margemAlvoPercentual: margem,
    },
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function mesReferenciaBr(ym: string): string {
  const [a, m] = ym.split("-");
  return `${MESES[Number(m) - 1] ?? m}/${a}`;
}

function Campo({ id, label, valor, onChange, placeholder, dica }: { id: string; label: string; valor: string; onChange: (v: string) => void; placeholder?: string; dica?: string }) {
  return (
    <div className="min-w-0">
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <input id={id} className={`mt-1 ${INPUT}`} inputMode="decimal" value={valor} placeholder={placeholder} onChange={(ev) => onChange(ev.target.value)} />
      {dica && <p className="mt-0.5 text-[11px] text-slate-500">{dica}</p>}
    </div>
  );
}

export function PremissasFinanceirasCampos({
  estado,
  onChange,
  cub,
  prefixo = "f",
}: {
  estado: EstadoFinanceiro;
  onChange: (e: EstadoFinanceiro) => void;
  cub: ReferenciaCub | null;
  prefixo?: string;
}) {
  const set = <K extends keyof EstadoFinanceiro>(k: K, v: EstadoFinanceiro[K]) => onChange({ ...estado, [k]: v });
  const custo = num(estado.custoM2);
  const razao = cub && typeof custo === "number" && custo > 0 ? custo / cub.valorM2 : null;
  const id = (s: string) => `${prefixo}-${s}`;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Terreno</legend>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Campo id={id("compra")} label="Valor de compra (R$)" valor={estado.valorCompra} onChange={(v) => set("valorCompra", v)} placeholder="3.000.000" dica="Em branco = só permuta" />
          </div>
          <Campo id={id("itbi")} label="ITBI (%)" valor={estado.itbi} onChange={(v) => set("itbi", v)} />
          <Campo id={id("escritura")} label="Escritura e registro (%)" valor={estado.escritura} onChange={(v) => set("escritura", v)} />
          <div className="col-span-2 sm:col-span-1">
            <span className={LABEL}>Permuta</span>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={estado.usarPermuta} onChange={(ev) => set("usarPermuta", ev.target.checked)} />
              Pagar parte em unidades
            </label>
            {estado.usarPermuta && (
              <input aria-label="Permuta (% do VGV)" className={`mt-1 ${INPUT}`} inputMode="decimal" value={estado.permuta} placeholder="% do VGV, ex.: 10" onChange={(ev) => set("permuta", ev.target.value)} />
            )}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Obra</legend>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Campo id={id("custo")} label="Custo de obra (R$/m² construído)" valor={estado.custoM2} onChange={(v) => set("custoM2", v)} placeholder="3.200" />
            {cub && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {cub.rotulo.split(" (")[0]} {mesReferenciaBr(cub.mesReferencia)}: {formatMoeda(cub.valorM2)}/m²
                {razao !== null && <> · seu custo = {razao.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} × CUB</>}
              </p>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={LABEL} htmlFor={id("modo-area")}>
              Área construída
            </label>
            <select id={id("modo-area")} className={`mt-1 ${INPUT}`} value={estado.modoArea} onChange={(ev) => set("modoArea", ev.target.value as "fator" | "area")}>
              <option value="fator">Calcular pelo fator</option>
              <option value="area">Digitar o total (m²)</option>
            </select>
            {estado.modoArea === "fator" ? (
              <input aria-label="Fator de área construída sobre a privativa" className={`mt-1 ${INPUT}`} inputMode="decimal" value={estado.fator} onChange={(ev) => set("fator", ev.target.value)} />
            ) : (
              <input aria-label="Área construída total (m²)" className={`mt-1 ${INPUT}`} inputMode="decimal" value={estado.areaConstruida} placeholder="8.000" onChange={(ev) => set("areaConstruida", ev.target.value)} />
            )}
            <p className="mt-0.5 text-[11px] text-slate-500">{estado.modoArea === "fator" ? "× a soma das áreas privativas (padrão 1,6)" : "total do projeto, com áreas comuns"}</p>
          </div>
          <Campo id={id("indiretos")} label="Indiretos (% da obra)" valor={estado.indiretos} onChange={(v) => set("indiretos", v)} dica="Projetos, aprovações, administração" />
          <Campo id={id("contingencia")} label="Contingência (% da obra)" valor={estado.contingencia} onChange={(v) => set("contingencia", v)} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comercial e margem</legend>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={LABEL} htmlFor={id("regime")}>
              Imposto
            </label>
            <select id={id("regime")} className={`mt-1 ${INPUT}`} value={estado.regime} onChange={(ev) => set("regime", ev.target.value as RegimeImposto)}>
              <option value="ret4">RET 4% (padrão)</option>
              <option value="ret1">RET 1% (MCMV / HIS)</option>
              <option value="outro">Outro percentual</option>
            </select>
            {estado.regime === "outro" && (
              <input aria-label="Imposto (% do VGV)" className={`mt-1 ${INPUT}`} inputMode="decimal" value={estado.impostoOutro} placeholder="% do VGV" onChange={(ev) => set("impostoOutro", ev.target.value)} />
            )}
          </div>
          <Campo id={id("comissao")} label="Comissão (% do VGV)" valor={estado.comissao} onChange={(v) => set("comissao", v)} />
          <Campo id={id("marketing")} label="Marketing (% do VGV)" valor={estado.marketing} onChange={(v) => set("marketing", v)} />
          <Campo id={id("margem")} label="Margem desejada (% do VGV)" valor={estado.margemAlvo} onChange={(v) => set("margemAlvo", v)} dica="Usada no valor máximo do terreno" />
        </div>
      </fieldset>

      {cub && (
        <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {cub.observacao} Fonte: {cub.fonte}.
          </span>
        </p>
      )}
    </div>
  );
}
