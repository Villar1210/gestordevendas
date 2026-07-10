// src/features/kanban/components/QuickCardModal.tsx
// Modal do botao "+ Novo Negocio" no cabecalho geral (fora de uma coluna
// especifica). So 3 campos - o card ja nasce com dono (usuario logado) e
// direto na primeira stage do pipeline (POST /cards com pipelineId, sem
// stageId). "Imovel de Interesse" nao tem coluna propria no Card, entao
// vai para customFields; quem representa o card (title) e o nome do contato.
"use client";

import { useEffect, useState, FormEvent } from "react";
import { X } from "lucide-react";
import { useKanbanStore } from "../store/useKanbanStore";
import { useKanbanIntegration } from "../hooks/useKanbanIntegration";

export function QuickCardModal() {
  const isOpen = useKanbanStore((state) => state.quickCardModalOpen);
  const pipelineId = useKanbanStore((state) => state.pipelineId);
  const closeQuickCardModal = useKanbanStore((state) => state.closeQuickCardModal);
  const { handleCreateCard } = useKanbanIntegration();

  const [nomeContato, setNomeContato] = useState("");
  const [phone, setPhone] = useState("");
  const [imovelDeInteresse, setImovelDeInteresse] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNomeContato("");
    setPhone("");
    setImovelDeInteresse("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pipelineId) return;
    setSaving(true);
    try {
      await handleCreateCard({
        pipelineId,
        title: nomeContato,
        value: 0,
        phone: phone.trim() || null,
        customFields: imovelDeInteresse.trim()
          ? { imovelDeInteresse: imovelDeInteresse.trim() }
          : {},
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeQuickCardModal}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Novo Negocio</h2>
          <button
            onClick={closeQuickCardModal}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-500">Nome do Contato</label>
            <input
              type="text"
              required
              value={nomeContato}
              onChange={(e) => setNomeContato(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">Telefone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 91234-5678"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">Imovel de Interesse</label>
            <input
              type="text"
              value={imovelDeInteresse}
              onChange={(e) => setImovelDeInteresse(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeQuickCardModal}
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
