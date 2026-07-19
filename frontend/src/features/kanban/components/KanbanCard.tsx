// src/features/kanban/components/KanbanCard.tsx
import { MouseEvent, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { MessageCircle, Clock } from "lucide-react";
import { Card, useKanbanStore } from "../store/useKanbanStore";
import { useKanbanIntegration } from "../hooks/useKanbanIntegration";

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
  const isHighlighted = useKanbanStore((state) => state.highlightedCardId === card.id);
  const meuUserId = useKanbanStore((state) => state.meuUserId);
  const { handleAceitarLead } = useKanbanIntegration();
  const [isAceitando, setAceitando] = useState(false);

  const origemStyle = ORIGEM_STYLES[card.origem] ?? ORIGEM_STYLES.manual;
  const origemLabel = ORIGEM_LABELS[card.origem] ?? card.origem;
  const temperaturaStyle = card.temperatura ? TEMPERATURA_STYLES[card.temperatura] : null;
  const temperaturaLabel = card.temperatura ? TEMPERATURA_LABELS[card.temperatura] : null;
  // Timeout de aceite da Roleta Online (modo automatico) - ver
  // features/roleta. So mostra o botao para quem e o dono atual (o
  // Administrador tambem pode aceitar via API, mas sem botao dedicado
  // aqui - ver CLAUDE.md).
  const aguardandoAceite = Boolean(card.atribuidoAutomaticamenteEm) && !card.aceitoEm;
  const podeAceitar = aguardandoAceite && card.ownerId === meuUserId;

  function handleWhatsAppClick(e: MouseEvent) {
    e.stopPropagation();
    if (!card.phone) return;
    const digitsOnly = card.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${digitsOnly}`, "_blank");
  }

  async function handleAceitarClick(e: MouseEvent) {
    e.stopPropagation();
    setAceitando(true);
    try {
      await handleAceitarLead(card.id);
    } finally {
      setAceitando(false);
    }
  }

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-card-id={card.id}
          onClick={() => openCardDetailPanel(card)}
          className={`mb-3 cursor-pointer rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition ${
            snapshot.isDragging ? "shadow-md" : ""
          } ${isHighlighted ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
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
            {aguardandoAceite && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                <Clock className="h-3 w-3" /> Aguardando aceite
              </span>
            )}
          </div>

          <span className="text-sm font-semibold text-slate-800">
            {currencyFormatter.format(card.value)}
          </span>

          {podeAceitar && (
            <button
              onClick={handleAceitarClick}
              disabled={isAceitando}
              className="mt-2 w-full rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {isAceitando ? "Aceitando..." : "Aceitar Lead"}
            </button>
          )}

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
