// src/features/kanban/components/CardFormModal.tsx
// Modal de CRIACAO de card (simples e rapido). A edicao completa de um card
// existente (incluindo valor/temperatura/campos personalizados) acontece no
// CardDetailPanel, aberto ao clicar num card ja criado.
"use client";

import { useEffect, useState, FormEvent } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useKanbanStore } from "../store/useKanbanStore";
import { useKanbanIntegration } from "../hooks/useKanbanIntegration";

const TEMPERATURE_OPTIONS = [
  { value: "", label: "Nao definida" },
  { value: "quente", label: "🔥 Quente" },
  { value: "morno", label: "☀️ Morno" },
  { value: "frio", label: "❄️ Frio" },
];

interface CustomFieldRow {
  key: string;
  value: string;
}

export function CardFormModal() {
  const cardModal = useKanbanStore((state) => state.cardModal);
  const closeCardModal = useKanbanStore((state) => state.closeCardModal);
  const { handleCreateCard } = useKanbanIntegration();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [phone, setPhone] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [customFieldRows, setCustomFieldRows] = useState<CustomFieldRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cardModal.isOpen) return;
    setTitle("");
    setValue("");
    setPhone("");
    setTemperatura("");
    setCustomFieldRows([]);
  }, [cardModal]);

  if (!cardModal.isOpen) return null;

  function handleAddCustomField() {
    setCustomFieldRows((rows) => [...rows, { key: "", value: "" }]);
  }

  function handleRemoveCustomField(index: number) {
    setCustomFieldRows((rows) => rows.filter((_, i) => i !== index));
  }

  function handleCustomFieldChange(index: number, field: "key" | "value", newVal: string) {
    setCustomFieldRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: newVal } : row)),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cardModal.stageId) return;
    setSaving(true);

    const customFields: Record<string, unknown> = {};
    for (const row of customFieldRows) {
      if (row.key.trim()) customFields[row.key.trim()] = row.value;
    }

    const parsedValue = Number(value) || 0;

    try {
      await handleCreateCard({
        stageId: cardModal.stageId,
        title,
        value: parsedValue,
        phone: phone.trim() || null,
        temperatura: temperatura || null,
        customFields,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeCardModal}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Novo card</h2>
          <button
            onClick={closeCardModal}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-500">Titulo</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">Telefone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 91234-5678"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">Temperatura</label>
            <select
              value={temperatura}
              onChange={(e) => setTemperatura(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            >
              {TEMPERATURE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm text-slate-500">Campos personalizados</label>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar campo
              </button>
            </div>
            <div className="space-y-2">
              {customFieldRows.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Chave"
                    value={row.key}
                    onChange={(e) => handleCustomFieldChange(index, "key", e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <input
                    type="text"
                    placeholder="Valor"
                    value={row.value}
                    onChange={(e) => handleCustomFieldChange(index, "value", e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(index)}
                    className="text-slate-400 hover:text-red-500"
                    aria-label="Remover campo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeCardModal}
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
