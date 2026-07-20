// src/features/kanban/components/MotivoRepiqueModal.tsx
// Modal obrigatorio ao mover um card manualmente (drag-and-drop) para a
// stage "Repique" - resolve o item do BACKLOG.md ("Modal obrigatorio de
// motivo da perda"). Componente controlado (sem estado global proprio) -
// KanbanBoard.tsx guarda o movimento pendente e so chama handleMoveCard
// depois que um motivo e confirmado aqui. Cancelar simplesmente nao
// aplica nenhuma mudanca no board (o card volta visualmente pra posicao
// original, ja que o store nunca foi atualizado).
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { MOTIVO_REPIQUE_OPTIONS } from "../constants";

interface MotivoRepiqueModalProps {
  isOpen: boolean;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
}

export function MotivoRepiqueModal({ isOpen, onConfirm, onCancel }: MotivoRepiqueModalProps) {
  const [motivo, setMotivo] = useState("");

  if (!isOpen) return null;

  function handleConfirm() {
    if (!motivo) return;
    onConfirm(motivo);
    setMotivo("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Motivo do Repique</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          Selecione o motivo de mover este negocio para Repique - isso ajuda a entender por que o
          lead nao avancou e a preparar futuras acoes de reengajamento.
        </p>

        <div className="space-y-2">
          {MOTIVO_REPIQUE_OPTIONS.map((option) => (
            <label
              key={option.value}
              data-testid={`motivo-repique-option-${option.value}`}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                motivo === option.value
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="motivoRepique"
                value={option.value}
                checked={motivo === option.value}
                onChange={() => setMotivo(option.value)}
                className="accent-blue-600"
              />
              {option.label}
            </label>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!motivo}
            data-testid="motivo-repique-confirmar"
            className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
