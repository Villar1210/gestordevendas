// src/features/kanban/components/KanbanCard.tsx
import { MouseEvent } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { MessageCircle } from "lucide-react";
import { Card, useKanbanStore } from "../store/useKanbanStore";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const ORIGEM_STYLES: Record<string, string> = {
  manual: "bg-slate-100 text-slate-600",
  webhook: "bg-blue-100 text-blue-700",
  roleta_online: "bg-purple-100 text-purple-700",
};

const ORIGEM_LABELS: Record<string, string> = {
  manual: "Manual",
  webhook: "Webhook",
  roleta_online: "Roleta Online",
};

const TEMPERATURA_STYLES: Record<string, string> = {
  quente: "bg-red-100 text-red-700",
  morno: "bg-amber-100 text-amber-700",
  frio: "bg-sky-100 text-sky-700",
};

const TEMPERATURA_LABELS: Record<string, string> = {
  quente: "🔥 Quente",
  morno: "☀️ Morno",
  frio: "❄️ Frio",
};

interface KanbanCardProps {
  card: Card;
  index: number;
  isDragDisabled?: boolean;
}

export function KanbanCard({ card, index, isDragDisabled }: KanbanCardProps) {
  const openCardDetailPanel = useKanbanStore((state) => state.openCardDetailPanel);

  const origemStyle = ORIGEM_STYLES[card.origem] ?? ORIGEM_STYLES.manual;
  const origemLabel = ORIGEM_LABELS[card.origem] ?? card.origem;
  const temperaturaStyle = card.temperatura ? TEMPERATURA_STYLES[card.temperatura] : null;
  const temperaturaLabel = card.temperatura ? TEMPERATURA_LABELS[card.temperatura] : null;

  function handleWhatsAppClick(e: MouseEvent) {
    e.stopPropagation();
    if (!card.phone) return;
    const digitsOnly = card.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${digitsOnly}`, "_blank");
  }

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => openCardDetailPanel(card)}
          className={`mb-3 cursor-pointer rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition ${
            snapshot.isDragging ? "shadow-md" : ""
          }`}
        >
          <p className="mb-2 text-sm font-medium text-slate-800">{card.title}</p>

          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${origemStyle}`}>
              {origemLabel}
            </span>
            {temperaturaStyle && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${temperaturaStyle}`}>
                {temperaturaLabel}
              </span>
            )}
          </div>

          <span className="text-sm font-semibold text-slate-800">
            {currencyFormatter.format(card.value)}
          </span>

          {card.phone && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <button
                onClick={handleWhatsAppClick}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-green-600"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
