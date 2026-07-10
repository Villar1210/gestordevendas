// src/app/dashboard/kanban/page.tsx
"use client";

import { useEffect, useRef } from "react";
import { Loader2, Plus } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { useKanbanStore } from "@/features/kanban/store/useKanbanStore";
import { useKanbanIntegration } from "@/features/kanban/hooks/useKanbanIntegration";
import { KanbanBoard } from "@/features/kanban/components/KanbanBoard";
import { KanbanFilters } from "@/features/kanban/components/KanbanFilters";
import { InboxView } from "@/features/kanban/components/InboxView";
import { QuickCardModal } from "@/features/kanban/components/QuickCardModal";
import { CardDetailPanel } from "@/features/kanban/components/CardDetailPanel";

interface Pipeline {
  id: string;
  name: string;
}

export default function KanbanDashboardPage() {
  const isLoading = useKanbanStore((state) => state.isLoading);
  const setLoading = useKanbanStore((state) => state.setLoading);
  const activeView = useKanbanStore((state) => state.activeView);
  const setActiveView = useKanbanStore((state) => state.setActiveView);
  const openQuickCardModal = useKanbanStore((state) => state.openQuickCardModal);
  const { loadBoard } = useKanbanIntegration();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    async function init() {
      setLoading(true);
      try {
        const pipelines = await apiRequest<Pipeline[]>("/pipelines");
        let pipeline = pipelines[0];

        if (!pipeline) {
          pipeline = await apiRequest<Pipeline>("/pipelines/default", { method: "POST" });
        }

        await loadBoard(pipeline.id);
      } finally {
        setLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-800">Pipeline de Vendas</h1>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setActiveView("kanban")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "kanban"
                  ? "bg-amber-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setActiveView("inbox")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "inbox"
                  ? "bg-amber-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Caixa de Entrada
            </button>
          </div>
        </div>

        <button
          onClick={openQuickCardModal}
          className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          <Plus className="h-4 w-4" /> Novo Negocio
        </button>
      </header>

      {!isLoading && activeView === "kanban" && <KanbanFilters />}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          <p className="text-sm">Carregando pipeline...</p>
        </div>
      ) : activeView === "kanban" ? (
        <KanbanBoard />
      ) : (
        <InboxView />
      )}

      <QuickCardModal />
      <CardDetailPanel />
    </div>
  );
}
