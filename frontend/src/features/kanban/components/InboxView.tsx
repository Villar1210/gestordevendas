// src/features/kanban/components/InboxView.tsx
"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { useKanbanStore, Card } from "../store/useKanbanStore";
import { useKanbanIntegration } from "../hooks/useKanbanIntegration";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

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

export function InboxView() {
  const pipelineId = useKanbanStore((state) => state.pipelineId);
  const openCardDetailPanel = useKanbanStore((state) => state.openCardDetailPanel);
  const { handleGetInbox, handleClaimCard } = useKanbanIntegration();

  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    if (!pipelineId) return;
    setIsLoading(true);
    handleGetInbox(pipelineId)
      .then(setCards)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]);

  async function handleStartAttendance(card: Card) {
    setClaimingId(card.id);
    try {
      const claimed = await handleClaimCard(card.id);
      if (claimed) {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        openCardDetailPanel(claimed);
      }
    } finally {
      setClaimingId(null);
    }
  }

  if (isLoading) {
    return <p className="p-6 text-sm text-slate-400">Carregando Caixa de Entrada...</p>;
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-400">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">Nenhum lead novo na Caixa de Entrada.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-800">{card.title}</p>

          {card.temperatura && (
            <span
              className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                TEMPERATURA_STYLES[card.temperatura] ?? ""
              }`}
            >
              {TEMPERATURA_LABELS[card.temperatura] ?? card.temperatura}
            </span>
          )}

          {card.phone && <p className="text-xs text-slate-500">{card.phone}</p>}

          <p className="text-sm font-semibold text-slate-800">
            {currencyFormatter.format(card.value)}
          </p>

          <button
            onClick={() => handleStartAttendance(card)}
            disabled={claimingId === card.id}
            className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {claimingId === card.id ? "Assumindo..." : "Iniciar Atendimento"}
          </button>
        </div>
      ))}
    </div>
  );
}
