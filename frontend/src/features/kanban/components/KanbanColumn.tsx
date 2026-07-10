// src/features/kanban/components/KanbanColumn.tsx
import { Droppable, DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { Stage, useKanbanStore } from "../store/useKanbanStore";
import { KanbanCard } from "./KanbanCard";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

interface KanbanColumnProps {
  stage: Stage;
  innerRef: (element: HTMLElement | null) => void;
  draggableProps: React.HTMLAttributes<HTMLDivElement>;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
}

export function KanbanColumn({
  stage,
  innerRef,
  draggableProps,
  dragHandleProps,
}: KanbanColumnProps) {
  const searchTerm = useKanbanStore((state) => state.searchTerm);
  const temperatureFilter = useKanbanStore((state) => state.temperatureFilter);
  const origemFilter = useKanbanStore((state) => state.origemFilter);
  const hasActiveFilters = useKanbanStore((state) => state.hasActiveFilters());
  const openCreateCardModal = useKanbanStore((state) => state.openCreateCardModal);

  const total = stage.cards.reduce((sum, card) => sum + card.value, 0);

  // Filtragem e so visual: nao remove nada do estado do Zustand, apenas
  // decide o que renderizar. Enquanto algum filtro estiver ativo, o
  // arraste fica desabilitado (ver KanbanCard) para nao dessincronizar o
  // indice visual (lista filtrada) do indice real usado no /move.
  const visibleCards = stage.cards.filter((card) => {
    const matchesSearch =
      !searchTerm.trim() || card.title.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesTemperature =
      temperatureFilter === "all" || card.temperatura === temperatureFilter;
    const matchesOrigem = origemFilter === "all" || card.origem === origemFilter;
    return matchesSearch && matchesTemperature && matchesOrigem;
  });

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className="flex w-72 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div {...dragHandleProps} className="cursor-grab border-b border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">{stage.name}</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {stage.cards.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{currencyFormatter.format(total)}</p>
      </div>

      <Droppable droppableId={stage.id} type="card">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="min-h-[40px] flex-1 overflow-y-auto p-3"
          >
            {visibleCards.map((card, index) => (
              <KanbanCard
                key={card.id}
                card={card}
                index={index}
                isDragDisabled={hasActiveFilters}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="border-t border-slate-200 p-2">
        <button
          onClick={() => openCreateCardModal(stage.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-blue-600"
        >
          <Plus className="h-4 w-4" /> Novo Card
        </button>
      </div>
    </div>
  );
}
