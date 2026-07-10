// src/app/dashboard/equipe/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Users } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { useEquipeStore } from "@/features/equipe/store/useEquipeStore";
import { useEquipeIntegration } from "@/features/equipe/hooks/useEquipeIntegration";
import { getStatusDisponibilidadeOption } from "@/features/equipe/constants";
import { CorretorFormModal } from "@/features/equipe/components/CorretorFormModal";
import { RoletaConfigCard } from "@/features/roleta/components/RoletaConfigCard";

export default function EquipePage() {
  const corretores = useEquipeStore((state) => state.corretores);
  const isLoading = useEquipeStore((state) => state.isLoading);
  const openCorretorFormModal = useEquipeStore((state) => state.openCorretorFormModal);
  const { loadCorretores } = useEquipeIntegration();
  const hasInitialized = useRef(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadCorretores();
    apiRequest<{ role: string }>("/auth/me")
      .then((me) => setRole(me.role))
      .catch(() => setRole(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Equipe</h1>
        <button
          onClick={openCorretorFormModal}
          className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          <Plus className="h-4 w-4" /> Novo Corretor
        </button>
      </header>

      <div className="space-y-6 p-6">
        {role === "Administrador" && <RoletaConfigCard />}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            <p className="text-sm">Carregando corretores...</p>
          </div>
        ) : corretores.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <Users className="h-8 w-8" />
            <p className="text-sm">Nenhum corretor cadastrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {corretores.map((corretor) => {
                  const statusOption = getStatusDisponibilidadeOption(
                    corretor.statusDisponibilidade,
                  );
                  return (
                    <tr key={corretor.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{corretor.name}</td>
                      <td className="px-4 py-3 text-slate-500">{corretor.email}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusOption.dotClassName}`} />
                          {statusOption.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CorretorFormModal />
    </div>
  );
}
