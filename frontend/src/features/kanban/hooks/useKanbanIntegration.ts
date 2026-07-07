// src/features/kanban/hooks/useKanbanIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { useKanbanStore, Stage, Card } from "../store/useKanbanStore";

interface BoardResponse {
  id: string;
  name: string;
  createdAt: string;
  stages: Stage[];
}

export interface CreateCardInput {
  // Informe stageId (criacao dentro de uma coluna) OU pipelineId
  // (criacao pelo cabecalho - entra direto na primeira stage do pipeline).
  stageId?: string;
  pipelineId?: string;
  title: string;
  value: number;
  phone?: string | null;
  temperatura?: string | null;
  customFields?: Record<string, unknown>;
}

export interface CreateQuickCardInput {
  pipelineId: string;
  title: string;
  value?: number;
  phone?: string | null;
  temperatura?: string | null;
  customFields?: Record<string, unknown>;
}

export interface UpdateCardInput {
  title?: string;
  value?: number;
  phone?: string | null;
  temperatura?: string | null;
  email?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  customFields?: Record<string, unknown>;
}

export interface Activity {
  id: string;
  cardId: string;
  type: string;
  subject: string | null;
  scheduledAt: string | null;
  done: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  cardId: string;
  body: string;
  createdAt: string;
}

export interface CreateActivityInput {
  type: string;
  subject?: string;
  scheduledAt?: string;
}

export function useKanbanIntegration() {
  const setPipelineId = useKanbanStore((state) => state.setPipelineId);
  const setStages = useKanbanStore((state) => state.setStages);
  const setLoading = useKanbanStore((state) => state.setLoading);
  const moveCardOptimistic = useKanbanStore((state) => state.moveCardOptimistic);
  const moveStageOptimistic = useKanbanStore((state) => state.moveStageOptimistic);
  const addCard = useKanbanStore((state) => state.addCard);
  const updateCardInPlace = useKanbanStore((state) => state.updateCardInPlace);
  const closeCardModal = useKanbanStore((state) => state.closeCardModal);
  const closeQuickCardModal = useKanbanStore((state) => state.closeQuickCardModal);

  const loadBoard = useCallback(
    async (pipelineId: string) => {
      setLoading(true);
      try {
        const board = await apiRequest<BoardResponse>(`/pipelines/${pipelineId}/board`);
        setPipelineId(pipelineId);
        setStages(board.stages);
      } finally {
        setLoading(false);
      }
    },
    [setPipelineId, setStages, setLoading],
  );

  const handleMoveCard = useCallback(
    async (
      cardId: string,
      sourceStageId: string,
      targetStageId: string,
      targetIndex: number,
    ) => {
      const rollback = moveCardOptimistic(cardId, sourceStageId, targetStageId, targetIndex);
      try {
        await apiRequest(`/cards/${cardId}/move`, {
          method: "PATCH",
          body: JSON.stringify({ targetStageId, targetIndex }),
        });
      } catch (err) {
        rollback();
        alert(err instanceof ApiError ? err.message : "Nao foi possivel mover o card.");
      }
    },
    [moveCardOptimistic],
  );

  const handleMoveStage = useCallback(
    async (stageId: string, targetIndex: number) => {
      const rollback = moveStageOptimistic(stageId, targetIndex);
      try {
        await apiRequest(`/stages/${stageId}/move`, {
          method: "PATCH",
          body: JSON.stringify({ targetIndex }),
        });
      } catch (err) {
        rollback();
        alert(err instanceof ApiError ? err.message : "Nao foi possivel mover a coluna.");
      }
    },
    [moveStageOptimistic],
  );

  const handleCreateCard = useCallback(
    async (input: CreateCardInput) => {
      try {
        const card = await apiRequest<Card>("/cards", {
          method: "POST",
          body: JSON.stringify(input),
        });
        addCard(card);
        closeCardModal();
        closeQuickCardModal();
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o card.");
      }
    },
    [addCard, closeCardModal, closeQuickCardModal],
  );

  const handleUpdateCard = useCallback(
    async (cardId: string, input: UpdateCardInput) => {
      try {
        const card = await apiRequest<Card>(`/cards/${cardId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        });
        updateCardInPlace(card);
        return card;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar o card.");
        return null;
      }
    },
    [updateCardInPlace],
  );

  const handleCreateActivity = useCallback(
    async (cardId: string, input: CreateActivityInput) => {
      try {
        return await apiRequest<Activity>(`/cards/${cardId}/activities`, {
          method: "POST",
          body: JSON.stringify(input),
        });
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel agendar a atividade.");
        return null;
      }
    },
    [],
  );

  const handleListActivities = useCallback(async (cardId: string) => {
    try {
      return await apiRequest<Activity[]>(`/cards/${cardId}/activities`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar as atividades.");
      return [];
    }
  }, []);

  const handleToggleActivityDone = useCallback(async (activityId: string) => {
    try {
      return await apiRequest<Activity>(`/activities/${activityId}/toggle-done`, {
        method: "PATCH",
      });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel atualizar a atividade.");
      return null;
    }
  }, []);

  const handleCreateNote = useCallback(async (cardId: string, body: string) => {
    try {
      return await apiRequest<Note>(`/cards/${cardId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel adicionar a nota.");
      return null;
    }
  }, []);

  const handleListNotes = useCallback(async (cardId: string) => {
    try {
      return await apiRequest<Note[]>(`/cards/${cardId}/notes`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar as notas.");
      return [];
    }
  }, []);

  const handleCreateQuickCard = useCallback(async (input: CreateQuickCardInput) => {
    try {
      return await apiRequest<Card>("/cards/quick", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o lead.");
      return null;
    }
  }, []);

  const handleGetInbox = useCallback(async (pipelineId: string) => {
    try {
      return await apiRequest<Card[]>(`/pipelines/${pipelineId}/inbox`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar a Caixa de Entrada.");
      return [];
    }
  }, []);

  const handleClaimCard = useCallback(
    async (cardId: string) => {
      try {
        const card = await apiRequest<Card>(`/cards/${cardId}/claim`, { method: "POST" });
        addCard(card);
        return card;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel assumir o lead.");
        return null;
      }
    },
    [addCard],
  );

  return {
    loadBoard,
    handleMoveCard,
    handleMoveStage,
    handleCreateCard,
    handleUpdateCard,
    handleCreateActivity,
    handleListActivities,
    handleToggleActivityDone,
    handleCreateNote,
    handleListNotes,
    handleCreateQuickCard,
    handleGetInbox,
    handleClaimCard,
  };
}
