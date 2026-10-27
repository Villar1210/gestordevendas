// src/features/kanban/components/AtendimentoViviView.tsx
// Fase B (27/10/2026): coluna "Atendimento VIVI" - leads que a VIVI do
// fazer.ai esta atendendo, antes de irem para um corretor. Todo o dashboard
// ve; o corretor so visualiza. A gestao (coordenador para cima e
// Administrador) pode mandar o lead direto para a Roleta. O bloqueio real e
// sempre no backend.
"use client";

import { useEffect, useState } from "react";
import { Bot, Clock, Send } from "lucide-react";
import { useKanbanStore, Card } from "../store/useKanbanStore";
import { useKanbanIntegration } from "../hooks/useKanbanIntegration";
import { useMe } from "@/core/hooks/useMe";

const DIAS_PARA_REPIQUE = 7;

function tempoDesde(iso: string | null | undefined): string {
  if (!iso) return "sem registro";
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

function diasRestantes(iso: string | null | undefined, criadoEm: string): number {
  const base = new Date(iso ?? criadoEm).getTime();
  const passados = (Date.now() - base) / 86_400_000;
  return Math.max(0, Math.ceil(DIAS_PARA_REPIQUE - passados));
}

export function AtendimentoViviView() {
  const pipelineId = useKanbanStore((state) => state.pipelineId);
  const openCardDetailPanel = useKanbanStore((state) => state.openCardDetailPanel);
  const { handleGetAtendimentoVivi, handleEncaminharParaRoleta } = useKanbanIntegration();
  const { podeAlterarStatus: ehGestao } = useMe();

  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!pipelineId) return;
    setIsLoading(true);
    handleGetAtendimentoVivi(pipelineId)
      .then(setCards)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]);

  async function encaminhar(card: Card) {
    setEnviandoId(card.id);
    try {
      const enviado = await handleEncaminharParaRoleta(card.id);
      if (enviado) setCards((prev) => prev.filter((c) => c.id !== card.id));
    } finally {
      setEnviandoId(null);
    }
  }

  if (isLoading) {
    return <p className="p-6 text-sm text-slate-400">Carregando Atendimento VIVI...</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <p className="text-sm text-slate-500">
        Leads que a VIVI está atendendo. Quando ela agenda uma visita ou o cliente pede um corretor, o lead vai
        para a Roleta. Sem resposta por {DIAS_PARA_REPIQUE} dias, vai para o Repique.
        {!ehGestao && " Você pode acompanhar, mas não mexer nestes leads."}
      </p>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-400">
          <Bot className="h-8 w-8" />
          <p className="text-sm">Nenhum lead em atendimento pela VIVI agora.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => openCardDetailPanel(card)}
                className="text-left text-sm font-medium text-slate-800 hover:text-blue-700"
              >
                {card.title}
              </button>
              <span className="flex w-fit items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                <Bot className="h-3 w-3" /> Com a VIVI
              </span>
              {card.phone && <p className="text-xs text-slate-500">{card.phone}</p>}
              {card.description && <p className="line-clamp-3 text-xs text-slate-600">{card.description}</p>}
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" /> Última mensagem {tempoDesde(card.ultimaInteracaoViviEm)} · Repique em{" "}
                {diasRestantes(card.ultimaInteracaoViviEm, card.createdAt)} dia(s)
              </p>
              {ehGestao && (
                <button
                  onClick={() => encaminhar(card)}
                  disabled={enviandoId === card.id}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {enviandoId === card.id ? "Enviando..." : "Mandar para a Roleta"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
