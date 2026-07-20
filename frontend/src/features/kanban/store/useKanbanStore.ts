// src/features/kanban/store/useKanbanStore.ts
import { create } from "zustand";

export interface Card {
  id: string;
  pipelineId: string;
  stageId: string | null;
  ownerId: string | null;
  // Sugestao da Roleta Online (modo semi_automatico) - so vem preenchido
  // pelo GET da Caixa de Entrada. suggestedOwnerName vem junto so ali.
  suggestedOwnerId: string | null;
  suggestedOwnerName: string | null;
  // Timeout de aceite da Roleta Online (modo automatico) - ver
  // features/roleta. Null = card nao passou por atribuicao automatica (ou
  // ja foi aceito/reatribuido).
  atribuidoAutomaticamenteEm: string | null;
  aceitoEm: string | null;
  // Motivo/data de entrada na stage "Repique" - ver
  // features/kanban/constants.ts (MOTIVO_REPIQUE_OPTIONS).
  motivoRepique: string | null;
  movidoParaRepiqueEm: string | null;
  // Motor de campanha do Repique - ver features/kanban/hooks/useKanbanIntegration.ts (handleDispararRepique).
  repiqueOptOut: boolean;
  title: string;
  value: number;
  position: number;
  origem: string;
  phone: string | null;
  temperatura: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  customFields: Record<string, unknown>;
}

export interface Stage {
  id: string;
  name: string;
  position: number;
  cards: Card[];
}

export interface Pipeline {
  id: string;
  name: string;
}

export type TemperatureFilter = "all" | "quente" | "morno" | "frio";
export type OrigemFilter = "all" | "manual" | "webhook" | "roleta_online";
export type KanbanView = "kanban" | "inbox";

interface CardModalState {
  isOpen: boolean;
  stageId: string | null;
}

interface CardDetailPanelState {
  isOpen: boolean;
  card: Card | null;
}

interface KanbanState {
  pipelineId: string | null;
  pipelines: Pipeline[];
  stages: Stage[];
  isLoading: boolean;
  activeView: KanbanView;
  // Sistema de permissoes por cargo hierarquico (RBAC) - so controla se o
  // BOTAO de excluir aparece (UX). A regra de verdade e sempre aplicada
  // pelo backend (BlockDeleteForCargoGuard) - default "true" (mostra) ate
  // /auth/me carregar, pra nao esconder o botao por engano num piscar de
  // olhos antes do fetch resolver.
  podeExcluirRegistroDeNegocio: boolean;
  // Id do usuario logado - usado so para o botao "Aceitar Lead" (Roleta
  // Online, timeout de aceite) saber se o card pertence a quem esta vendo
  // o Kanban agora. Null ate /auth/me resolver.
  meuUserId: string | null;

  searchTerm: string;
  temperatureFilter: TemperatureFilter;
  origemFilter: OrigemFilter;

  cardModal: CardModalState;
  cardDetailPanel: CardDetailPanelState;
  quickCardModalOpen: boolean;
  // Deep-link a partir do Dashboard do Corretor (/dashboard/inicio?...) -
  // destaca visualmente o card por alguns segundos apos abrir o board via
  // ?pipelineId=&cardId= (ver app/dashboard/kanban/page.tsx). Null = nenhum
  // destaque ativo.
  highlightedCardId: string | null;

  setPipelineId: (pipelineId: string) => void;
  setPipelines: (pipelines: Pipeline[]) => void;
  addPipeline: (pipeline: Pipeline) => void;
  setStages: (stages: Stage[]) => void;
  setLoading: (isLoading: boolean) => void;
  setActiveView: (view: KanbanView) => void;
  setPodeExcluirRegistroDeNegocio: (podeExcluir: boolean) => void;
  setMeuUserId: (userId: string | null) => void;

  setSearchTerm: (term: string) => void;
  setTemperatureFilter: (filter: TemperatureFilter) => void;
  setOrigemFilter: (filter: OrigemFilter) => void;
  hasActiveFilters: () => boolean;

  openCreateCardModal: (stageId: string) => void;
  closeCardModal: () => void;

  openCardDetailPanel: (card: Card) => void;
  closeCardDetailPanel: () => void;

  openQuickCardModal: () => void;
  closeQuickCardModal: () => void;

  setHighlightedCardId: (cardId: string | null) => void;

  addCard: (card: Card) => void;
  updateCardInPlace: (card: Card) => void;

  moveCardOptimistic: (
    cardId: string,
    sourceStageId: string,
    targetStageId: string,
    targetIndex: number,
  ) => () => void;
  moveStageOptimistic: (stageId: string, targetIndex: number) => () => void;

  addStage: (stage: Stage) => void;
  renameStageOptimistic: (stageId: string, name: string) => () => void;
  removeStageOptimistic: (stageId: string) => () => void;
}

// Mesmo algoritmo de posicionamento flutuante usado no backend, aplicado
// localmente so para manter os dados internamente plausiveis ate o
// proximo loadBoard(). A ordem visual real vem da ordem do array.
function calculatePosition(siblings: { position: number }[], targetIndex: number): number {
  if (siblings.length === 0) return 1000;
  if (targetIndex === 0) return siblings[0].position / 2;
  if (targetIndex >= siblings.length) {
    return siblings[siblings.length - 1].position + 1000;
  }
  return (siblings[targetIndex - 1].position + siblings[targetIndex].position) / 2;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  pipelineId: null,
  pipelines: [],
  stages: [],
  isLoading: false,
  activeView: "kanban",
  podeExcluirRegistroDeNegocio: true,
  meuUserId: null,

  searchTerm: "",
  temperatureFilter: "all",
  origemFilter: "all",

  cardModal: { isOpen: false, stageId: null },
  cardDetailPanel: { isOpen: false, card: null },
  quickCardModalOpen: false,
  highlightedCardId: null,

  setPipelineId: (pipelineId) => set({ pipelineId }),
  setPipelines: (pipelines) => set({ pipelines }),
  addPipeline: (pipeline) => set({ pipelines: [...get().pipelines, pipeline] }),
  setStages: (stages) => set({ stages }),
  setLoading: (isLoading) => set({ isLoading }),
  setActiveView: (activeView) => set({ activeView }),
  setPodeExcluirRegistroDeNegocio: (podeExcluirRegistroDeNegocio) =>
    set({ podeExcluirRegistroDeNegocio }),
  setMeuUserId: (meuUserId) => set({ meuUserId }),

  setSearchTerm: (term) => set({ searchTerm: term }),
  setTemperatureFilter: (filter) => set({ temperatureFilter: filter }),
  setOrigemFilter: (filter) => set({ origemFilter: filter }),
  hasActiveFilters: () => {
    const { searchTerm, temperatureFilter, origemFilter } = get();
    return searchTerm.trim() !== "" || temperatureFilter !== "all" || origemFilter !== "all";
  },

  openCreateCardModal: (stageId) => set({ cardModal: { isOpen: true, stageId } }),
  closeCardModal: () => set({ cardModal: { isOpen: false, stageId: null } }),

  openCardDetailPanel: (card) => set({ cardDetailPanel: { isOpen: true, card } }),
  closeCardDetailPanel: () => set({ cardDetailPanel: { isOpen: false, card: null } }),

  openQuickCardModal: () => set({ quickCardModalOpen: true }),
  closeQuickCardModal: () => set({ quickCardModalOpen: false }),

  setHighlightedCardId: (highlightedCardId) => set({ highlightedCardId }),

  addCard: (card) => {
    if (!card.stageId) return;
    set({
      stages: get().stages.map((stage) =>
        stage.id === card.stageId ? { ...stage, cards: [...stage.cards, card] } : stage,
      ),
    });
  },

  updateCardInPlace: (card) => {
    set({
      stages: get().stages.map((stage) =>
        stage.id === card.stageId
          ? { ...stage, cards: stage.cards.map((c) => (c.id === card.id ? card : c)) }
          : stage,
      ),
      // Mantem o painel de detalhes em sincronia se o card editado for o que esta aberto
      cardDetailPanel:
        get().cardDetailPanel.card?.id === card.id
          ? { isOpen: true, card }
          : get().cardDetailPanel,
    });
  },

  moveCardOptimistic: (cardId, sourceStageId, targetStageId, targetIndex) => {
    const previousStages = get().stages;

    const sourceStage = previousStages.find((s) => s.id === sourceStageId);
    const card = sourceStage?.cards.find((c) => c.id === cardId);

    if (!card) {
      return () => {};
    }

    const nextStages = previousStages.map((stage) => {
      if (stage.id === sourceStageId) {
        return { ...stage, cards: stage.cards.filter((c) => c.id !== cardId) };
      }
      return stage;
    });

    const targetStage = nextStages.find((s) => s.id === targetStageId);
    if (!targetStage) {
      return () => {};
    }

    const siblingCards = targetStage.cards;
    const newPosition = calculatePosition(siblingCards, targetIndex);
    const movedCard: Card = { ...card, stageId: targetStageId, position: newPosition };

    const updatedCards = [...siblingCards];
    updatedCards.splice(targetIndex, 0, movedCard);

    const finalStages = nextStages.map((stage) =>
      stage.id === targetStageId ? { ...stage, cards: updatedCards } : stage,
    );

    set({ stages: finalStages });

    return () => set({ stages: previousStages });
  },

  moveStageOptimistic: (stageId, targetIndex) => {
    const previousStages = get().stages;

    const stage = previousStages.find((s) => s.id === stageId);
    if (!stage) {
      return () => {};
    }

    const remainingStages = previousStages.filter((s) => s.id !== stageId);
    const newPosition = calculatePosition(remainingStages, targetIndex);
    const movedStage: Stage = { ...stage, position: newPosition };

    const nextStages = [...remainingStages];
    nextStages.splice(targetIndex, 0, movedStage);

    set({ stages: nextStages });

    return () => set({ stages: previousStages });
  },

  addStage: (stage) => set({ stages: [...get().stages, stage] }),

  renameStageOptimistic: (stageId, name) => {
    const previousStages = get().stages;
    set({
      stages: previousStages.map((stage) => (stage.id === stageId ? { ...stage, name } : stage)),
    });
    return () => set({ stages: previousStages });
  },

  removeStageOptimistic: (stageId) => {
    const previousStages = get().stages;
    set({ stages: previousStages.filter((stage) => stage.id !== stageId) });
    return () => set({ stages: previousStages });
  },
}));
