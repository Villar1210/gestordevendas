// Formulario da nova analise por endereco: endereco, raio (botoes
// segmentados - 3 opcoes fixas, sem digitar), periodo e area opcional.
"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { ENDERECO_MAX, ENDERECO_MIN, PERIODO_MESES_OPCOES, RAIO_OPCOES, TIPO_OPCOES } from "../../constants-endereco";
import { useBiiAnaliseStore } from "../../store/useBiiAnaliseStore";
import type { AnaliseEnderecoInput, PeriodoMeses, TipoImovelItbi } from "../../types-endereco";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50";

function lerArea(texto: string): number | null | "invalida" {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? n : "invalida";
}

interface AnaliseEnderecoFormProps {
  onAnalisar: (input: AnaliseEnderecoInput) => void;
  carregando: boolean;
}

export function AnaliseEnderecoForm({ onAnalisar, carregando }: AnaliseEnderecoFormProps) {
  const form = useBiiAnaliseStore((s) => s.form);
  const setCampo = useBiiAnaliseStore((s) => s.setCampo);
  const [erros, setErros] = useState<{ endereco?: string; area?: string }>({});

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const endereco = form.endereco.trim().replace(/\s+/g, " ");
    const areaMin = lerArea(form.areaMin);
    const areaMax = lerArea(form.areaMax);
    const novosErros: typeof erros = {};
    if (endereco.length < ENDERECO_MIN) novosErros.endereco = "Digite o endereço com rua, número e bairro.";
    else if (endereco.length > ENDERECO_MAX) novosErros.endereco = `Use no máximo ${ENDERECO_MAX} caracteres.`;
    if (areaMin === "invalida" || areaMax === "invalida") novosErros.area = "Informe a área em m², só números.";
    else if (areaMin !== null && areaMax !== null && areaMin > areaMax)
      novosErros.area = "A área mínima precisa ser menor que a máxima.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const input: AnaliseEnderecoInput = {
      endereco,
      raioMetros: form.raioMetros,
      meses: form.meses,
      tipo: form.tipo,
      somenteCompraVenda: form.somenteCompraVenda,
    };
    if (typeof areaMin === "number") input.areaMin = areaMin;
    if (typeof areaMax === "number") input.areaMax = areaMax;
    onAnalisar(input);
  }

  return (
    <form onSubmit={enviar} noValidate className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-800">Nova análise por endereço</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Digite o endereço do terreno ou do empreendimento. O BII busca as vendas registradas no ITBI dentro do raio
        escolhido.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <label htmlFor="bii-endereco" className="text-xs font-medium text-slate-600">
            Endereço
          </label>
          <input
            id="bii-endereco"
            type="text"
            value={form.endereco}
            onChange={(e) => setCampo("endereco", e.target.value)}
            maxLength={ENDERECO_MAX}
            placeholder="Ex.: Av. Vila Ema, 3000, Vila Ema, São Paulo"
            autoComplete="street-address"
            disabled={carregando}
            aria-invalid={erros.endereco ? true : undefined}
            aria-describedby="bii-endereco-dica"
            className={`mt-1 ${INPUT} ${erros.endereco ? "border-red-400" : ""}`}
          />
          <p id="bii-endereco-dica" className={`mt-1 text-xs ${erros.endereco ? "text-red-600" : "text-slate-500"}`}>
            {erros.endereco ?? "Rua, número, bairro, São Paulo"}
          </p>
        </div>

        <fieldset className="min-w-0">
          <legend className="text-xs font-medium text-slate-600">Raio</legend>
          <div className="mt-1 inline-flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Raio">
            {RAIO_OPCOES.map((r) => (
              <button
                key={r.value}
                type="button"
                disabled={carregando}
                aria-pressed={form.raioMetros === r.value}
                onClick={() => setCampo("raioMetros", r.value)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  form.raioMetros === r.value ? "bg-blue-700 text-white" : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,20rem)_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="bii-tipo" className="text-xs font-medium text-slate-600">
            Tipo de imóvel
          </label>
          <select
            id="bii-tipo"
            value={form.tipo}
            disabled={carregando}
            onChange={(e) => setCampo("tipo", e.target.value as TipoImovelItbi)}
            className={`mt-1 ${INPUT}`}
          >
            {TIPO_OPCOES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-start gap-2 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.somenteCompraVenda}
            disabled={carregando}
            onChange={(e) => setCampo("somenteCompraVenda", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-700"
          />
          <span>
            Só compra e venda
            <span className="block text-xs text-slate-500">Deixa de fora herança, permuta, leilão e integralização de capital.</span>
          </span>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(3,minmax(0,10rem))_auto] sm:items-start">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="bii-meses" className="text-xs font-medium text-slate-600">
            Período
          </label>
          <select
            id="bii-meses"
            value={form.meses}
            disabled={carregando}
            onChange={(e) => setCampo("meses", Number(e.target.value) as PeriodoMeses)}
            className={`mt-1 ${INPUT}`}
          >
            {PERIODO_MESES_OPCOES.map((p) => (
              <option key={p.value} value={p.value}>
                Últimos {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bii-area-min" className="text-xs font-medium text-slate-600">
            Área mín. (m²)
          </label>
          <input
            id="bii-area-min"
            type="text"
            inputMode="decimal"
            value={form.areaMin}
            disabled={carregando}
            onChange={(e) => setCampo("areaMin", e.target.value)}
            placeholder="opcional"
            aria-invalid={erros.area ? true : undefined}
            className={`mt-1 ${INPUT} ${erros.area ? "border-red-400" : ""}`}
          />
        </div>
        <div>
          <label htmlFor="bii-area-max" className="text-xs font-medium text-slate-600">
            Área máx. (m²)
          </label>
          <input
            id="bii-area-max"
            type="text"
            inputMode="decimal"
            value={form.areaMax}
            disabled={carregando}
            onChange={(e) => setCampo("areaMax", e.target.value)}
            placeholder="opcional"
            aria-invalid={erros.area ? true : undefined}
            className={`mt-1 ${INPUT} ${erros.area ? "border-red-400" : ""}`}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 sm:pt-5">
          <button
            type="submit"
            disabled={carregando}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            {carregando ? "Analisando..." : "Analisar"}
          </button>
        </div>
      </div>
      {erros.area && <p className="mt-1 text-xs text-red-600">{erros.area}</p>}
      <p className="mt-3 text-xs text-slate-400">
        Endereço convertido em coordenadas pelo OpenStreetMap (Nominatim). Cada análise fica salva no Histórico.
      </p>
    </form>
  );
}
