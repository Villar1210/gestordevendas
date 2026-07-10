// src/features/imoveis/components/EmpreendimentoFormModal.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { X } from "lucide-react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";

export function EmpreendimentoFormModal() {
  const isOpen = useImoveisStore((state) => state.empreendimentoFormModalOpen);
  const closeEmpreendimentoFormModal = useImoveisStore(
    (state) => state.closeEmpreendimentoFormModal,
  );
  const { handleCreateEmpreendimento } = useImoveisIntegration();

  const [name, setName] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setRua("");
    setNumero("");
    setBairro("");
    setCidade("");
    setUf("");
    setCep("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await handleCreateEmpreendimento({
        name,
        rua,
        numero,
        bairro,
        cidade,
        uf: uf.toUpperCase(),
        cep,
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
      aria-label="Novo Empreendimento"
      onClick={closeEmpreendimentoFormModal}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Novo Empreendimento</h2>
          <button
            onClick={closeEmpreendimentoFormModal}
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
              placeholder="Nome do empreendimento"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">Endereco</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  required
                  placeholder="Rua"
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  className="w-2/3 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
                <input
                  type="text"
                  required
                  placeholder="Numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="w-1/3 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <input
                type="text"
                required
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />

              <div className="flex gap-3">
                <input
                  type="text"
                  required
                  placeholder="Cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
                <input
                  type="text"
                  required
                  maxLength={2}
                  placeholder="UF"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  className="w-1/4 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
                <input
                  type="text"
                  required
                  placeholder="CEP"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  className="w-1/4 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeEmpreendimentoFormModal}
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
