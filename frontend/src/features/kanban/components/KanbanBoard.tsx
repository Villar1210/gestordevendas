// src/features/kanban/components/KanbanBoard.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useKanbanStore } from "../store/useKanbanStore";
import { useKanbanIntegration } from "../hooks/useKanbanIntegration";
import { KanbanColumn } from "./KanbanColumn";
import { CardFormModal } from "./CardFormModal";
import { MotivoRepiqueModal } from "./MotivoRepiqueModal";
import { REPIQUE_STAGE_NAME } from "../constants";

interface PendingRepiqueMove {
  cardId: string;
  sourceStageId: string;
  targetStageId: string;
  targetIndex: number;
}

export function KanbanBoard() {
  const stages = useKanbanStore((state) => state.stages);
  const pipelineId = useKanbanStore((state) => state.pipelineId);
  const { handleMoveCard, handleMoveStage, handleCreateStage } = useKanbanIntegration();

  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  // Movimento pendente de confirmacao de motivo (drag para a stage
  // "Repique") - so aplica no store/API depois que o modal confirma um
  // motivo (ver MotivoRepiqueModal.tsx). Cancelar so limpa este estado
  // sem tocar no store, entao o card volta visualmente pra posicao
  // original (a ordem exibida vem sempre do proprio store).
  const [pendingRepiqueMove, setPendingRepiqueMove] = useState<PendingRepiqueMove | null>(null);

  async function commitNewStage() {
    const name = newStageName.trim();
    setNewStageName("");
    setIsAddingStage(false);
    if (name && pipelineId) {
      await handleCreateStage(pipelineId, name);
    }
  }

  function onDragEnd(result: DropResult) {
    const { source, destination, type, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    if (type === "column") {
      handleMoveStage(draggableId, destination.index);
      return;
    }

    const targetStage = stages.find((stage) => stage.id === destination.droppableId);
    if (targetStage?.name === REPIQUE_STAGE_NAME) {
      // Nao move ainda - abre o modal e so aplica a movimentacao real
      // quando um motivo for confirmado (ver handleConfirmMotivoRepique).
      setPendingRepiqueMove({
        cardId: draggableId,
        sourceStageId: source.droppableId,
        targetStageId: destination.droppableId,
        targetIndex: destination.index,
      });
      return;
    }

    handleMoveCard(draggableId, source.droppableId, destination.droppableId, destination.index);
  }

  function handleConfirmMotivoRepique(motivo: string) {
    if (!pendingRepiqueMove) return;
    handleMoveCard(
      pendingRepiqueMove.cardId,
      pendingRepiqueMove.sourceStageId,
      pendingRepiqueMove.targetStageId,
      pendingRepiqueMove.targetIndex,
      motivo,
    );
    setPendingRepiqueMove(null);
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" type="column" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-4 overflow-x-auto p-6"
            >
              {stages.map((stage, index) => (
                <Draggable draggableId={stage.id} index={index} key={stage.id}>
                  {(providedDraggable) => (
                    <KanbanColumn
                      stage={stage}
                      innerRef={providedDraggable.innerRef}
                      draggableProps={providedDraggable.draggableProps}
                      dragHandleProps={providedDraggable.dragHandleProps}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              <div className="w-72 shrink-0">
                {isAddingStage ? (
                  <div className="rounded-2xl border border-blue-300 bg-white p-3 shadow-sm">
                    <input
                      autoFocus
                      data-testid="new-stage-input"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      onBlur={commitNewStage}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitNewStage();
                        if (e.key === "Escape") {
                          setNewStageName("");
                          setIsAddingStage(false);
                        }
                      }}
                      placeholder="Nome da coluna"
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingStage(true)}
                    data-testid="add-stage-button"
                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-white/50 py-3 text-sm font-medium text-slate-500 transition hover:border-blue-400 hover:text-blue-600"
                  >
                    <Plus className="h-4 w-4" /> Adicionar Coluna
                  </button>
                )}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <CardFormModal />
      <MotivoRepiqueModal
        isOpen={pendingRepiqueMove !== null}
        onConfirm={handleConfirmMotivoRepique}
        onCancel={() => setPendingRepiqueMove(null)}
      />
    </>
  );
}
