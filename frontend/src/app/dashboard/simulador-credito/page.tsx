"use client";
// src/app/dashboard/simulador-credito/page.tsx

import { useState, FormEvent } from "react";
import { apiRequest, ApiError } from "@/core/api/client";

interface SimulacaoResult {
  elegivel: boolean;
  motivoNaoElegivel?: string;
  faixaRenda?: string;
  faixaEtaria?: string;
  financiamento?: number;
  subsidio?: number;
  primeiraParcela?: number;
  taxaEfetiva?: number;
  tetoAvaliacao?: number;
  temRedutor?: boolean;
  resumoTexto: string;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number) {
  return (v * 100).toFixed(2).replace(".", ",") + "% a.a.";
}

// Máscara em reais: "4000" vira "4.000" e "4000,5" vira "4.000,5".
// Antes a máscara tratava os dígitos como centavos ("4000" virava R$ 40,00).
function formatarRenda(valor: string): string {
  const limpo = valor.replace(/[^\d,]/g, "");
  if (!limpo) return "";
  const [inteiroBruto, ...resto] = limpo.split(",");
  const inteiro = inteiroBruto.replace(/^0+(?=\d)/, "");
  const inteiroFormatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (resto.length === 0) return inteiroFormatado;
  const centavos = resto.join("").slice(0, 2);
  return `${inteiroFormatado || "0"},${centavos}`;
}

function parsearRenda(valorFormatado: string): number {
  const limpo = valorFormatado.replace(/\./g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}

const RENDA_MINIMA = 1700;
const IDADE_MINIMA = 21;
const IDADE_MAXIMA = 80;

export default function SimuladorCreditoPage() {
  const [rendaDisplay, setRendaDisplay] = useState("");
  const [idade, setIdade] = useState("");
  const [temDependente, setTemDependente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulacaoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const renda = parsearRenda(rendaDisplay);
    const idadeNumero = parseInt(idade, 10);
    if (renda < RENDA_MINIMA) {
      setError("A renda familiar mínima para simular é R$ 1.700,00.");
      return;
    }
    if (isNaN(idadeNumero) || idadeNumero < IDADE_MINIMA || idadeNumero > IDADE_MAXIMA) {
      setError(`A idade precisa estar entre ${IDADE_MINIMA} e ${IDADE_MAXIMA} anos.`);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        renda: String(renda),
        idade,
        temDependente: String(temDependente),
      });
      const data = await apiRequest<SimulacaoResult>(
        `/simulador/credito?${params}`
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao simular.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold text-slate-800">
        Simulador de Credito
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Minha Casa Minha Vida - Tabela APROVE 2026
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Renda familiar bruta
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={rendaDisplay}
                  onChange={(e) => {
                    setRendaDisplay(formatarRenda(e.target.value));
                  }}
                  placeholder="Ex: 4.000"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Idade do comprador mais velho
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={IDADE_MINIMA}
                max={IDADE_MAXIMA}
                required
                value={idade}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setIdade(v);
                }}
                placeholder="Ex: 35"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={temDependente}
              onChange={(e) => setTemDependente(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            Possui dependente (filho/a)
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 py-2.5 font-medium text-white transition hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? "Calculando..." : "Simular financiamento"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`mt-6 rounded-2xl border p-6 shadow-sm ${
            result.elegivel
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          {result.elegivel ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-emerald-800">
                    Cliente elegivel
                  </p>
                  <p className="text-sm text-emerald-600">
                    {result.faixaRenda} - Faixa etaria {result.faixaEtaria} anos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card
                  label="Financiamento"
                  value={fmt(result.financiamento!)}
                  icon="💰"
                  highlight
                />
                {result.subsidio ? (
                  <Card
                    label="Subsidio"
                    value={fmt(result.subsidio)}
                    icon="🎁"
                    highlight
                  />
                ) : null}
                {result.subsidio ? (
                  <Card
                    label="Valor total do financiamento"
                    value={fmt(result.financiamento! + result.subsidio)}
                    icon="🏠"
                  />
                ) : null}
                <Card
                  label="1a parcela estimada"
                  value={fmt(result.primeiraParcela!)}
                  icon="💳"
                />
                <Card
                  label="Taxa efetiva"
                  value={fmtPct(result.taxaEfetiva!)}
                  icon="📉"
                  sub={result.temRedutor ? "com redutor social" : undefined}
                />
                {result.tetoAvaliacao ? (
                  <Card
                    label="Teto de avaliacao"
                    value={fmt(result.tetoAvaliacao)}
                    icon="🏷️"
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <p className="font-semibold text-red-800">
                  Cliente nao elegivel
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {result.motivoNaoElegivel}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  icon,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-emerald-300 bg-white"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="mb-0.5 text-xs text-slate-500">
        {icon} {label}
      </p>
      <p className="font-semibold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
