// src/features/pdf_tools/components/SortableGrid.tsx
// Grade reordenavel com @hello-pangea/dnd. A biblioteca so ordena listas
// (1 eixo), entao a grade e montada como N linhas horizontais (uma
// Droppable por linha) e o indice global = linha * colunas + posicao.
// O numero de colunas acompanha a largura do container (ResizeObserver).
// Teclado: foco no card + Espaco para pegar, setas para mover, Espaco solta.
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DropResult,
} from "@hello-pangea/dnd";

export interface SortableRenderArgs {
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  isDragging: boolean;
}

interface SortableGridProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T, index: number) => string;
  renderItem: (item: T, index: number, args: SortableRenderArgs) => ReactNode;
  onReorder: (from: number, to: number) => void;
  minItemWidth: number;
  gap?: number;
  idPrefix: string;
}

function useColumns(minItemWidth: number, gap: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const width = node.clientWidth;
      setCols(Math.max(1, Math.floor((width + gap) / (minItemWidth + gap))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [minItemWidth, gap]);
  return { ref, cols };
}

export function SortableGrid<T>({
  items,
  getKey,
  getLabel,
  renderItem,
  onReorder,
  minItemWidth,
  gap = 16,
  idPrefix,
}: SortableGridProps<T>) {
  const { ref, cols } = useColumns(minItemWidth, gap);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));

  function handleDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    const rowOf = (droppableId: string) => Number(droppableId.split(":")[1]);
    const from = rowOf(source.droppableId) * cols + source.index;
    let to = rowOf(destination.droppableId) * cols + destination.index;
    // Ao descer para outra linha, o item sai da posicao original antes de
    // entrar na nova - o indice global de destino "anda" uma casa para tras.
    if (rowOf(destination.droppableId) > rowOf(source.droppableId)) to -= 1;
    to = Math.max(0, Math.min(items.length - 1, to));
    if (from !== to) onReorder(from, to);
  }

  const itemWidth = `calc((100% - ${(cols - 1) * gap}px) / ${cols})`;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div ref={ref} className="flex flex-col" style={{ gap }}>
        {rows.map((row, rowIndex) => (
          <Droppable key={rowIndex} droppableId={`${idPrefix}:${rowIndex}`} direction="horizontal">
            {(dropProvided) => (
              <div
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                className="flex min-h-10"
                style={{ gap }}
              >
                {row.map((item, i) => {
                  const index = rowIndex * cols + i;
                  const key = getKey(item);
                  return (
                    <Draggable key={key} draggableId={`${idPrefix}-${key}`} index={i}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          aria-label={getLabel(item, index)}
                          className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          style={{ ...dragProvided.draggableProps.style, width: itemWidth }}
                        >
                          {renderItem(item, index, {
                            dragHandleProps: dragProvided.dragHandleProps,
                            isDragging: snapshot.isDragging,
                          })}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
