// src/features/imoveis/components/ProprietariosTab.tsx
"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import { ProprietarioFormModal } from "./ProprietarioFormModal";

export function ProprietariosTab() {
  const proprietarios = useImoveisStore((state) => state.proprietarios);
  const openProprietarioFormModal = useImoveisStore((state) => state.openProprietarioFormModal);
  const { loadProprietarios } = useImoveisIntegration();

  useEffect(() => {
    loadProprietarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-6 py-4">
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={openProprietarioFormModal}
          className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          <Plus className="h-4 w-4" /> Novo Proprietario
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Documento</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Imoveis Vinculados</th>
            </tr>
          </thead>
          <tbody>
            {proprietarios.map((proprietario) => (
              <tr
                key={proprietario.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{proprietario.nome}</p>
                  {proprietario.email && (
                    <p className="text-xs text-slate-400">{proprietario.email}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{proprietario.cpfCnpj ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{proprietario.telefone}</td>
                <td className="px-4 py-3 text-slate-600">{proprietario.imoveisVinculados ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {proprietarios.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Nenhum proprietario cadastrado.
          </p>
        )}
      </div>

      <ProprietarioFormModal />
    </div>
  );
}
