// src/app/dashboard/kanban/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { podeExcluirRegistroDeNegocio } from "@/core/constants/cargoEscopo";
import { useKanbanStore } from "@/features/kanban/store/useKanbanStore";
import { useKanbanIntegration } from "@/features/kanban/hooks/useKanbanIntegration";
import { KanbanBoard } from "@/features/kanban/components/KanbanBoard";
import { KanbanFilters } from "@/features/kanban/components/KanbanFilters";
import { InboxView } from "@/features/kanban/components/InboxView";
import { QuickCardModal } from "@/features/kanban/components/QuickCardModal";
import { CardDetailPanel } from "@/features/kanban/components/CardDetailPanel";
import { PlantaoStatusBadge } from "@/features/plantao/components/PlantaoStatusBadge";

interface Pipeline {
  id: string;
  name: string;
}

interface Me {
  role: string;
  cargoHierarquico: string | null;
}

export default function KanbanDashboardPage() {
  const isLoading = useKanbanStore((state) => state.isLoading);
  const setLoading = useKanbanStore((state) => state.setLoading);
  const activeView = useKanbanStore((state) => state.activeView);
  const setActiveView = useKanbanStore((state) => state.setActiveView);
  const openQuickCardModal = useKanbanStore((state) => state.openQuickCardModal);
  const pipelineId = useKanbanStore((state) => state.pipelineId);
  const pipelines = useKanbanStore((state) => state.pipelines);
  const setPipelines = useKanbanStore((state) => state.setPipelines);
  const setPodeExcluirRegistroDeNegocio = useKanbanStore(
    (state) => state.setPodeExcluirRegistroDeNegocio,
  );
  const openCardDetailPanel = useKanbanStore((state) => state.openCardDetailPanel);
  const setHighlightedCardId = useKanbanStore((state) => state.setHighlightedCardId);
  const { loadBoard, handleCreatePipeline } = useKanbanIntegration();
  const hasInitialized = useRef(false);
  const router = useRouter();

  const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    async function init() {
      setLoading(true);
      try {
        const fetchedPipelines = await apiRequest<Pipeline[]>("/pipelines");

        // Deep-link a partir do Dashboard do Corretor
        // (/dashboard/inicio?pipelineId=&cardId=) - le direto de
        // window.location (nao useSearchParams, que exigiria envolver a
        // pagina numa Suspense boundary so por causa disso).
        const params = new URLSearchParams(window.location.search);
        const pipelineIdParam = params.get("pipelineId");
        const cardIdParam = params.get("cardId");

        let pipeline =
          fetchedPipelines.find((p) => p.id === pipelineIdParam) ?? fetchedPipelines[0];

        if (!pipeline) {
          pipeline = await apiRequest<Pipeline>("/pipelines/default", { method: "POST" });
          fetchedPipelines.push(pipeline);
        }

        setPipelines(fetchedPipelines);
        await loadBoard(pipeline.id);

        if (cardIdParam) {
          const loadedStages = useKanbanStore.getState().stages;
          const card = loadedStages.flatMap((stage) => stage.cards).find((c) => c.id === cardIdParam);
          if (card) {
            openCardDetailPanel(card);
            setHighlightedCardId(card.id);
            setTimeout(() => setHighlightedCardId(null), 3000);
            requestAnimationFrame(() => {
              document
                .querySelector(`[data-card-id="${card.id}"]`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
          }
          router.replace("/dashboard/kanban");
        }
      } finally {
        setLoading(false);
      }
    }

    // Sistema de permissoes por cargo hierarquico (RBAC) - decide se o
    // botao de excluir coluna aparece. Nao bloqueia nada de verdade (isso
    // e sempre feito pelo backend, BlockDeleteForCargoGuard) - so evita
    // mostrar um botao que a API ja rejeitaria.
    apiRequest<Me>("/auth/me")
      .then((me) => {
        setPodeExcluirRegistroDeNegocio(podeExcluirRegistroDeNegocio(me.role, me.cargoHierarquico));
      })
      .catch(() => {});

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectPipeline(id: string) {
    if (id === pipelineId) return;
    setActiveView("kanban");
    loadBoard(id);
  }

  async function commitNewPipeline() {
    const name = newPipelineName.trim();
    setNewPipelineName("");
    setIsCreatingPipeline(false);
    if (!name) return;

    const pipeline = await handleCreatePipeline(name);
    if (pipeline) {
      setActiveView("kanban");
      await loadBoard(pipeline.id);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          {pipelines.length > 1 ? (
            <select
              data-testid="pipeline-select"
              value={pipelineId ?? ""}
              onChange={(e) => handleSelectPipeline(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-lg font-semibold text-slate-800 outline-none focus:border-blue-500"
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="text-lg font-semibold text-slate-800">
              {pipelines[0]?.name ?? "Pipeline de Vendas"}
            </h1>
          )}

          {isCreatingPipeline ? (
            <input
              autoFocus
              data-testid="new-pipeline-input"
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              onBlur={commitNewPipeline}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNewPipeline();
                if (e.key === "Escape") {
                  setNewPipelineName("");
                  setIsCreatingPipeline(false);
                }
              }}
              placeholder="Nome do novo funil"
              className="rounded-lg border border-blue-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            />
          ) : (
            <button
              onClick={() => setIsCreatingPipeline(true)}
              data-testid="add-pipeline-button"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:border-blue-400 hover:text-blue-600"
              title="Criar novo funil"
            >
              <Plus className="h-3.5 w-3.5" /> Novo Funil
            </button>
          )}

          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setActiveView("kanban")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "kanban"
                  ? "bg-blue-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setActiveView("inbox")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "inbox"
                  ? "bg-blue-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Caixa de Entrada
            </button>
          </div>

          <PlantaoStatusBadge />
        </div>

        <button
          onClick={openQuickCardModal}
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          <Plus className="h-4 w-4" /> Novo Negocio
        </button>
      </header>

      {!isLoading && activeView === "kanban" && <KanbanFilters />}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
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
