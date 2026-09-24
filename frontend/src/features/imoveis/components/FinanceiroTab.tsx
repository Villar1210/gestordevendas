// src/features/imoveis/components/FinanceiroTab.tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, TrendingUp, TrendingDown, Wallet, FileText } from "lucide-react";
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

function isOverdue(vencimento: string, status: string): boolean {
  if (status === "pago") return false;
  return new Date(vencimento) < new Date();
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed right-4 top-4 z-[9999] flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-medium shadow-lg text-white ${type === "success" ? "bg-green-600" : "bg-red-600"}`}>
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">x</button>
    </div>
  );
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
  const [periodoFilter, setPeriodoFilter] = useState("");
  const [gerando, setGerando] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
        setToast({
          message: result.criados > 0
            ? `${result.criados} cobrança(s) gerada(s) com sucesso.`
            : "Nenhuma cobrança nova — lançamentos do mês-alvo já existem.",
          type: result.criados > 0 ? "success" : "error",
        });
      }
    } finally {
      setGerando(false);
    }
  }

  async function handleMarcarPagoClick(lancamentoId: string) {
    if (confirmandoId === lancamentoId) {
      await handleMarcarComoPago(lancamentoId);
      setConfirmandoId(null);
    } else {
      setConfirmandoId(lancamentoId);
    }
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
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <TrendingUp className="h-4 w-4 text-green-600" /> Total a Receber
          </div>
          <p className="text-xl font-semibold text-slate-800">{currencyFormatter.format(totalAReceber)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <TrendingDown className="h-4 w-4 text-red-600" /> Total a Pagar/Repasse
          </div>
          <p className="text-xl font-semibold text-slate-800">{currencyFormatter.format(totalAPagar)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Wallet className="h-4 w-4 text-blue-600" /> Recebido este mês
          </div>
          <p className="text-xl font-semibold text-slate-800">{currencyFormatter.format(totalRecebidoNoMes)}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-600">
            <option value="">Todos os tipos</option>
            {TIPO_LANCAMENTO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-600">
            <option value="">Todos os status</option>
            {STATUS_LANCAMENTO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input type="month" value={periodoFilter} onChange={(e) => setPeriodoFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-600" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGerarCobrancasClick} disabled={gerando} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${gerando ? "animate-spin" : ""}`} />
            Gerar cobranças do mês
          </button>
          <button onClick={openLancamentoFormModal} className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" /> Novo Lançamento
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <th className="px-4 py-3 font-medium">Imóvel/Contrato</th>
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
              const overdue = isOverdue(lancamento.vencimento, lancamento.status);
              const confirmando = confirmandoId === lancamento.id;
              return (
                <tr key={lancamento.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${overdue ? "bg-red-50/50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-1.5">
                      <span className={`font-medium ${overdue ? "text-red-700" : "text-slate-800"}`}>
                        {imovel?.title ?? "Avulso"}
                      </span>
                      {lancamento.descricao && (
                        <span title={lancamento.descricao} className="mt-0.5 cursor-help text-slate-400">
                          <FileText className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    {lancamento.descricao && (
                      <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{lancamento.descricao}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{getTipoLancamentoLabel(lancamento.tipo)}</td>
                  <td className="px-4 py-3 text-slate-600">{getCategoriaLancamentoLabel(lancamento.categoria)}</td>
                  <td className={`px-4 py-3 font-medium ${overdue ? "text-red-700" : "text-slate-800"}`}>
                    {currencyFormatter.format(lancamento.valor)}
                  </td>
                  <td className={`px-4 py-3 ${overdue ? "font-medium text-red-600" : "text-slate-600"}`}>
                    {dateFormatter.format(new Date(lancamento.vencimento))}
                    {overdue && <span className="ml-1 text-xs text-red-500">(atrasado)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}>
                      {statusOption.label}
                    </span>
                    {lancamento.status === "pago" && lancamento.pagoEm && (
                      <p className="mt-0.5 text-xs text-slate-400">{dateFormatter.format(new Date(lancamento.pagoEm))}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {lancamento.status !== "pago" && (
                      confirmando ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleMarcarPagoClick(lancamento.id)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                            Confirmar
                          </button>
                          <button onClick={() => setConfirmandoId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleMarcarPagoClick(lancamento.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          Marcar como pago
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {lancamentos.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Wallet className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Nenhum lançamento encontrado</p>
              <p className="text-xs text-slate-400">Ajuste os filtros ou crie um novo lançamento.</p>
            </div>
            <button onClick={openLancamentoFormModal} className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              <Plus className="h-4 w-4" /> Novo Lançamento
            </button>
          </div>
        )}
      </div>

      <LancamentoFormModal />
    </div>
  );
}
