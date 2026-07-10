// src/features/imoveis/components/LancamentoFormModal.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { X } from "lucide-react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import { TIPO_LANCAMENTO_OPTIONS, CATEGORIA_LANCAMENTO_OPTIONS } from "../constants";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

export function LancamentoFormModal() {
  const isOpen = useImoveisStore((state) => state.lancamentoFormModalOpen);
  const closeLancamentoFormModal = useImoveisStore((state) => state.closeLancamentoFormModal);
  const contratos = useImoveisStore((state) => state.contratos);
  const imoveis = useImoveisStore((state) => state.imoveis);
  const { handleCreateLancamento } = useImoveisIntegration();

  const [tipo, setTipo] = useState("receita");
  const [categoria, setCategoria] = useState("outro");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTipo("receita");
    setCategoria("outro");
    setValor("");
    setVencimento("");
    setContratoId("");
    setDescricao("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await handleCreateLancamento({
        contratoId: contratoId || undefined,
        tipo,
        categoria,
        valor: Number(valor),
        vencimento,
        descricao: descricao || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novo Lancamento"
      onClick={closeLancamentoFormModal}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Novo Lancamento</h2>
          <button
            onClick={closeLancamentoFormModal}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className={inputClass}
              >
                {TIPO_LANCAMENTO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Categoria</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className={inputClass}
              >
                {CATEGORIA_LANCAMENTO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Valor</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Vencimento</label>
              <input
                type="date"
                required
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">
              Contrato vinculado (opcional)
            </label>
            <select
              value={contratoId}
              onChange={(e) => setContratoId(e.target.value)}
              className={inputClass}
            >
              <option value="">Avulso (sem contrato)</option>
              {contratos.map((contrato) => {
                const imovel = imoveis.find((i) => i.id === contrato.imovelId);
                return (
                  <option key={contrato.id} value={contrato.id}>
                    {imovel?.title ?? contrato.imovelId}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">Descricao (opcional)</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeLancamentoFormModal}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
