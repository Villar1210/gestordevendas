// src/features/imoveis/components/ImovelFormModal.tsx
// Criacao rapida - so os campos essenciais. Os demais (codigo interno, uso,
// tags, situacao/chaves, proprietario, detalhes) sao preenchidos depois no
// ImovelDetailPanel, que abre automaticamente apos criar (mesmo padrao do
// QuickCardModal -> CardDetailPanel no Kanban).
"use client";

import { useEffect, useState, FormEvent } from "react";
import { X } from "lucide-react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import { FINALIDADE_OPTIONS, TIPO_OPTIONS } from "../constants";

export function ImovelFormModal() {
  const isOpen = useImoveisStore((state) => state.imovelFormModalOpen);
  const empreendimentos = useImoveisStore((state) => state.empreendimentos);
  const closeImovelFormModal = useImoveisStore((state) => state.closeImovelFormModal);
  const openImovelDetailPanel = useImoveisStore((state) => state.openImovelDetailPanel);
  const { handleCreateImovel } = useImoveisIntegration();

  const [empreendimentoId, setEmpreendimentoId] = useState("");
  const [title, setTitle] = useState("");
  const [tipo, setTipo] = useState(TIPO_OPTIONS[0].value);
  const [finalidade, setFinalidade] = useState(FINALIDADE_OPTIONS[0].value);
  const [price, setPrice] = useState("");
  const [rentPrice, setRentPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEmpreendimentoId("");
    setTitle("");
    setTipo(TIPO_OPTIONS[0].value);
    setFinalidade(FINALIDADE_OPTIONS[0].value);
    setPrice("");
    setRentPrice("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const imovel = await handleCreateImovel({
        empreendimentoId: empreendimentoId || undefined,
        title,
        tipo,
        finalidade,
        price: price ? Number(price) : undefined,
        rentPrice: rentPrice ? Number(rentPrice) : undefined,
      });
      if (imovel) {
        openImovelDetailPanel(imovel);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novo Imovel"
      onClick={closeImovelFormModal}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Novo Imovel</h2>
          <button
            onClick={closeImovelFormModal}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-500">Empreendimento</label>
            <select
              value={empreendimentoId}
              onChange={(e) => setEmpreendimentoId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            >
              <option value="">Avulso (sem empreendimento)</option>
              {empreendimentos.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">Titulo</label>
            <input
              type="text"
              required
              placeholder="ex: Apto 101 - 2 quartos"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-500">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              >
                {TIPO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-500">Finalidade</label>
              <select
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              >
                {FINALIDADE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-500">Preco de venda (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-500">Aluguel (R$/mes)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rentPrice}
                onChange={(e) => setRentPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeImovelFormModal}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
