// src/features/imoveis/components/FinanceiroTab.tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import {
  TIPO_LANCAMENTO_OPTIONS,
  STATUS_LANCAMENTO_OPTIONS,
  getTipoLancamentoLabel,
  getCategoriaLancamentoLabel,
  getStatusLancamentoOption,
} from "../constants";
import { LancamentoFormModal } from "./LancamentoFormModal";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function isSameMonth(dateStr: string, reference: Date): boolean {
  const date = new Date(dateStr);
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

export function FinanceiroTab() {
  const lancamentos = useImoveisStore((state) => state.lancamentos);
  const contratos = useImoveisStore((state) => state.contratos);
  const imoveis = useImoveisStore((state) => state.imoveis);
  const openLancamentoFormModal = useImoveisStore((state) => state.openLancamentoFormModal);
  const {
    loadImoveis,
    loadContratos,
    loadLancamentos,
    handleMarcarComoPago,
    handleGerarCobrancasDoMes,
  } = useImoveisIntegration();

  const [tipoFilter, setTipoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [periodoFilter, setPeriodoFilter] = useState(""); // "YYYY-MM"
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    loadImoveis();
    loadContratos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let vencimentoDe: string | undefined;
    let vencimentoAte: string | undefined;
    if (periodoFilter) {
      const [year, month] = periodoFilter.split("-").map(Number);
      // "YYYY-MM-DD" puro (date-only) - o backend usa parseDateOnly() para
      // interpretar no fuso local, nao new Date() direto (ver CLAUDE.md).
      const lastDay = new Date(year, month, 0).getDate();
      vencimentoDe = `${year}-${String(month).padStart(2, "0")}-01`;
      vencimentoAte = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
    loadLancamentos({
      tipo: tipoFilter || undefined,
      status: statusFilter || undefined,
      vencimentoDe,
      vencimentoAte,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoFilter, statusFilter, periodoFilter]);

  async function handleGerarCobrancasClick() {
    setGerando(true);
    try {
      const result = await handleGerarCobrancasDoMes();
      if (result) {
        alert(
          result.criados > 0
            ? `${result.criados} cobranca(s) gerada(s) com sucesso.`
            : "Nenhuma cobranca nova para gerar - ja existem lancamentos para o mes-alvo de cada contrato ativo.",
        );
      }
    } finally {
      setGerando(false);
    }
  }

  async function handleMarcarPagoClick(lancamentoId: string) {
    if (!confirm("Marcar este lancamento como pago?")) return;
    await handleMarcarComoPago(lancamentoId);
  }

  const totalAReceber = lancamentos
    .filter((l) => l.tipo === "receita" && l.status !== "pago")
    .reduce((sum, l) => sum + l.valor, 0);

  const totalAPagar = lancamentos
    .filter((l) => l.tipo === "repasse" && l.status !== "pago")
    .reduce((sum, l) => sum + l.valor, 0);

  const hoje = new Date();
  const totalRecebidoNoMes = lancamentos
    .filter(
      (l) => l.tipo === "receita" && l.status === "pago" && l.pagoEm && isSameMonth(l.pagoEm, hoje),
    )
    .reduce((sum, l) => sum + l.valor, 0);

  return (
    <div className="px-6 py-4">
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <TrendingUp className="h-4 w-4 text-green-600" /> Total a Receber
          </div>
          <p className="text-xl font-semibold text-slate-800">
            {currencyFormatter.format(totalAReceber)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <TrendingDown className="h-4 w-4 text-red-600" /> Total a Pagar/Repasse
          </div>
          <p className="text-xl font-semibold text-slate-800">
            {currencyFormatter.format(totalAPagar)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Wallet className="h-4 w-4 text-amber-600" /> Total Recebido no Mes
          </div>
          <p className="text-xl font-semibold text-slate-800">
            {currencyFormatter.format(totalRecebidoNoMes)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-600"
          >
            <option value="">Todos os tipos</option>
            {TIPO_LANCAMENTO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-600"
          >
            <option value="">Todos os status</option>
            {STATUS_LANCAMENTO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="month"
            value={periodoFilter}
            onChange={(e) => setPeriodoFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGerarCobrancasClick}
            disabled={gerando}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${gerando ? "animate-spin" : ""}`} />
            Gerar cobrancas do mes
          </button>
          <button
            onClick={openLancamentoFormModal}
            className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            <Plus className="h-4 w-4" /> Novo Lancamento
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <th className="px-4 py-3 font-medium">Imovel/Contrato</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((lancamento) => {
              const contrato = contratos.find((c) => c.id === lancamento.contratoId);
              const imovel = contrato ? imoveis.find((i) => i.id === contrato.imovelId) : null;
              const statusOption = getStatusLancamentoOption(lancamento.status);
              return (
                <tr
                  key={lancamento.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {imovel?.title ?? "Avulso"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {getTipoLancamentoLabel(lancamento.tipo)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {getCategoriaLancamentoLabel(lancamento.categoria)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {currencyFormatter.format(lancamento.valor)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {dateFormatter.format(new Date(lancamento.vencimento))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}
                    >
                      {statusOption.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {lancamento.status !== "pago" && (
                      <button
                        onClick={() => handleMarcarPagoClick(lancamento.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Marcar como pago
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {lancamentos.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Nenhum lancamento encontrado.
          </p>
        )}
      </div>

      <LancamentoFormModal />
    </div>
  );
}
