// src/features/aprovacoes/components/CadastroDetailPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { X, Check, Ban } from "lucide-react";
import { useAprovacoesStore } from "../store/useAprovacoesStore";
import { useAprovacoesIntegration } from "../hooks/useAprovacoesIntegration";
import { CARGO_HIERARQUICO_OPTIONS, ROLES_COM_HIERARQUIA, getTipoClienteLabel } from "../constants";

const selectClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}

export function CadastroDetailPanel() {
  const selectedId = useAprovacoesStore((state) => state.selectedId);
  const pendentes = useAprovacoesStore((state) => state.pendentes);
  const superiores = useAprovacoesStore((state) => state.superiores);
  const isSaving = useAprovacoesStore((state) => state.isSaving);
  const selectCadastro = useAprovacoesStore((state) => state.selectCadastro);
  const { loadPossiveisSuperiores, handleAprovar, handleRejeitar } = useAprovacoesIntegration();

  const [cargoHierarquico, setCargoHierarquico] = useState("");
  const [superiorId, setSuperiorId] = useState("");

  const cadastro = pendentes.find((p) => p.id === selectedId) ?? null;
  const precisaHierarquia = cadastro ? ROLES_COM_HIERARQUIA.includes(cadastro.roleName) : false;

  useEffect(() => {
    if (!cadastro) return;
    setCargoHierarquico("");
    setSuperiorId("");
    if (precisaHierarquia) {
      loadPossiveisSuperiores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastro?.id]);

  if (!cadastro) return null;

  async function onAprovar() {
    if (!cadastro) return;
    await handleAprovar(cadastro.id, {
      cargoHierarquico: cargoHierarquico || undefined,
      superiorId: superiorId || undefined,
    });
  }

  async function onRejeitar() {
    if (!cadastro) return;
    if (!confirm(`Rejeitar o cadastro de ${cadastro.name}?`)) return;
    await handleRejeitar(cadastro.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/40"
      onClick={() => selectCadastro(null)}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{cadastro.name}</h2>
            <p className="text-sm text-slate-500">{cadastro.roleName}</p>
          </div>
          <button
            onClick={() => selectCadastro(null)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <Field label="E-mail" value={cadastro.email} />
          <Field label="Telefone" value={cadastro.telefone} />
          <Field label="CPF" value={cadastro.cpf} />
          <Field label="CEP" value={cadastro.cep} />
          <Field label="Endereco" value={cadastro.endereco} />
          <Field label="CRECI" value={cadastro.creci} />
          <Field label="Nome da imobiliaria" value={cadastro.nomeImobiliaria} />
          <Field label="CNPJ" value={cadastro.cnpj} />
          <Field label="CRECI-J" value={cadastro.creciJ} />
          <Field label="Cargo na empresa" value={cadastro.cargoNaEmpresa} />
          {cadastro.tipoCliente && (
            <Field label="Tipo de cliente" value={getTipoClienteLabel(cadastro.tipoCliente)} />
          )}
        </div>

        {precisaHierarquia && (
          <div className="mt-4 space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-sm font-medium text-indigo-700">Hierarquia (ao aprovar)</p>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Cargo hierarquico</label>
              <select
                value={cargoHierarquico}
                onChange={(e) => setCargoHierarquico(e.target.value)}
                className={selectClass}
              >
                <option value="">Nao definir agora</option>
                {CARGO_HIERARQUICO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Superior direto</label>
              <select
                value={superiorId}
                onChange={(e) => setSuperiorId(e.target.value)}
                className={selectClass}
              >
                <option value="">Sem superior definido</option>
                {superiores.map((superior) => (
                  <option key={superior.id} value={superior.id}>
                    {superior.name} ({superior.cargoHierarquico})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onRejeitar}
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Ban className="h-4 w-4" /> Rejeitar
          </button>
          <button
            onClick={onAprovar}
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Check className="h-4 w-4" /> Aprovar
          </button>
        </div>
      </div>
    </div>
  );
}
