// src/app/dashboard/rh/aprovacoes/page.tsx
"use client";

import { useEffect, useRef } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { useAprovacoesStore } from "@/features/aprovacoes/store/useAprovacoesStore";
import { useAprovacoesIntegration } from "@/features/aprovacoes/hooks/useAprovacoesIntegration";
import { CadastroDetailPanel } from "@/features/aprovacoes/components/CadastroDetailPanel";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function AprovacoesPage() {
  const pendentes = useAprovacoesStore((state) => state.pendentes);
  const isLoading = useAprovacoesStore((state) => state.isLoading);
  const selectCadastro = useAprovacoesStore((state) => state.selectCadastro);
  const { loadPendentes } = useAprovacoesIntegration();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadPendentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Aprovacoes</h1>
      </header>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            <p className="text-sm">Carregando cadastros pendentes...</p>
          </div>
        ) : pendentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <UserCheck className="h-8 w-8" />
            <p className="text-sm">Nenhum cadastro pendente de aprovacao.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendentes.map((cadastro) => (
                  <tr
                    key={cadastro.id}
                    onClick={() => selectCadastro(cadastro.id)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{cadastro.name}</td>
                    <td className="px-4 py-3 text-slate-500">{cadastro.roleName}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {dateFormatter.format(new Date(cadastro.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CadastroDetailPanel />
    </div>
  );
}
