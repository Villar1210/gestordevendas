// src/features/equipe/components/CorretorFormModal.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { Mail, X } from "lucide-react";
import { useEquipeStore } from "../store/useEquipeStore";
import { useEquipeIntegration } from "../hooks/useEquipeIntegration";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

export function CorretorFormModal() {
  const isOpen = useEquipeStore((state) => state.corretorFormModalOpen);
  const closeCorretorFormModal = useEquipeStore((state) => state.closeCorretorFormModal);
  const { handleCreateCorretor } = useEquipeIntegration();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setEmail("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await handleCreateCorretor({ name, email });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novo Corretor"
      onClick={closeCorretorFormModal}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Novo Corretor</h2>
          <button
            onClick={closeCorretorFormModal}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              type="text"
              required
              placeholder="Nome do corretor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">E-mail</label>
            <input
              type="email"
              required
              placeholder="corretor@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Uma senha temporaria sera gerada automaticamente e enviada para este e-mail. O
              corretor podera troca-la apos o primeiro login.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeCorretorFormModal}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
