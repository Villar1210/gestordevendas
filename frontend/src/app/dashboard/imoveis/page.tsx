// src/app/dashboard/imoveis/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { useImoveisStore } from "@/features/imoveis/store/useImoveisStore";
import { useImoveisIntegration } from "@/features/imoveis/hooks/useImoveisIntegration";
import { ImoveisFilters } from "@/features/imoveis/components/ImoveisFilters";
import { ImovelCard } from "@/features/imoveis/components/ImovelCard";
import { ImovelListTable } from "@/features/imoveis/components/ImovelListTable";
import { ImovelFormModal } from "@/features/imoveis/components/ImovelFormModal";
import { EmpreendimentoFormModal } from "@/features/imoveis/components/EmpreendimentoFormModal";
import { ImovelDetailPanel } from "@/features/imoveis/components/ImovelDetailPanel";
import { EspelhoDeVendas } from "@/features/imoveis/components/EspelhoDeVendas";
import { ProprietariosTab } from "@/features/imoveis/components/ProprietariosTab";
import { ContratosTab } from "@/features/imoveis/components/ContratosTab";
import { FinanceiroTab } from "@/features/imoveis/components/FinanceiroTab";
import { InquilinosTab } from "@/features/imoveis/components/InquilinosTab";

export default function ImoveisDashboardPage() {
  const imoveis = useImoveisStore((state) => state.imoveis);
  const isLoading = useImoveisStore((state) => state.isLoading);
  const activeView = useImoveisStore((state) => state.activeView);
  const setActiveView = useImoveisStore((state) => state.setActiveView);
  const catalogLayout = useImoveisStore((state) => state.catalogLayout);
  const setCatalogLayout = useImoveisStore((state) => state.setCatalogLayout);
  const busca = useImoveisStore((state) => state.busca);
  const finalidadeFilter = useImoveisStore((state) => state.finalidadeFilter);
  const statusFilter = useImoveisStore((state) => state.statusFilter);
  const empreendimentoFilter = useImoveisStore((state) => state.empreendimentoFilter);
  const openImovelFormModal = useImoveisStore((state) => state.openImovelFormModal);
  const openEmpreendimentoFormModal = useImoveisStore(
    (state) => state.openEmpreendimentoFormModal,
  );

  const { loadImoveis, loadEmpreendimentos } = useImoveisIntegration();
  const [role, setRole] = useState<string | null>(null);
  const hasCheckedRole = useRef(false);

  useEffect(() => {
    loadEmpreendimentos();
    if (!hasCheckedRole.current) {
      hasCheckedRole.current = true;
      apiRequest<{ role: string }>("/auth/me")
        .then((me) => setRole(me.role))
        .catch(() => setRole(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Roda tambem no mount (com os filtros default), servindo como carga inicial.
  useEffect(() => {
    loadImoveis({
      busca,
      finalidade: finalidadeFilter,
      status: statusFilter,
      empreendimentoId: empreendimentoFilter,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, finalidadeFilter, statusFilter, empreendimentoFilter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-800">Imoveis</h1>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setActiveView("catalogo")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "catalogo"
                  ? "bg-amber-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Catalogo
            </button>
            <button
              onClick={() => setActiveView("espelho")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "espelho"
                  ? "bg-amber-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Espelho de Vendas
            </button>
            <button
              onClick={() => setActiveView("proprietarios")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "proprietarios"
                  ? "bg-amber-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Proprietarios
            </button>
            <button
              onClick={() => setActiveView("contratos")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "contratos"
                  ? "bg-amber-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Contratos
            </button>
            <button
              onClick={() => setActiveView("inquilinos")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "inquilinos"
                  ? "bg-amber-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Inquilinos
            </button>
            {role === "Administrador" && (
              <button
                onClick={() => setActiveView("financeiro")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  activeView === "financeiro"
                    ? "bg-amber-700 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Financeiro
              </button>
            )}
          </div>
        </div>

        {(activeView === "catalogo" || activeView === "espelho") && (
          <div className="flex items-center gap-2">
            <button
              onClick={openEmpreendimentoFormModal}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Novo Empreendimento
            </button>
            <button
              onClick={openImovelFormModal}
              className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              <Plus className="h-4 w-4" /> Novo Imovel
            </button>
          </div>
        )}
      </header>

      {activeView === "catalogo" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-3">
            <ImoveisFilters />
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              <button
                onClick={() => setCatalogLayout("cards")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  catalogLayout === "cards"
                    ? "bg-amber-700 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setCatalogLayout("lista")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  catalogLayout === "lista"
                    ? "bg-amber-700 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Lista
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              <p className="text-sm">Carregando imoveis...</p>
            </div>
          ) : (
            <div className="px-6 py-4">
              {catalogLayout === "cards" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {imoveis.map((imovel) => (
                    <ImovelCard key={imovel.id} imovel={imovel} />
                  ))}
                  {imoveis.length === 0 && (
                    <p className="col-span-full py-10 text-center text-sm text-slate-400">
                      Nenhum imovel encontrado.
                    </p>
                  )}
                </div>
              ) : (
                <ImovelListTable imoveis={imoveis} />
              )}
            </div>
          )}
        </>
      ) : activeView === "espelho" ? (
        <EspelhoDeVendas />
      ) : activeView === "proprietarios" ? (
        <ProprietariosTab />
      ) : activeView === "contratos" ? (
        <ContratosTab />
      ) : activeView === "inquilinos" ? (
        <InquilinosTab />
      ) : (
        <FinanceiroTab />
      )}

      <ImovelFormModal />
      <EmpreendimentoFormModal />
      <ImovelDetailPanel />
    </div>
  );
}
