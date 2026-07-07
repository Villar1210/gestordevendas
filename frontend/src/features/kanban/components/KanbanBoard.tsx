// src/features/kanban/components/KanbanBoard.tsx
"use client";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useKanbanStore } from "../store/useKanbanStore";
import { useKanbanIntegration } from "../hooks/useKanbanIntegration";
import { KanbanColumn } from "./KanbanColumn";
import { CardFormModal } from "./CardFormModal";

export function KanbanBoard() {
  const stages = useKanbanStore((state) => state.stages);
  const { handleMoveCard, handleMoveStage } = useKanbanIntegration();

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

    handleMoveCard(draggableId, source.droppableId, destination.droppableId, destination.index);
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
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <CardFormModal />
    </>
  );
}
