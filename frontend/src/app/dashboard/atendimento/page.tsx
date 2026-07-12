// src/app/dashboard/atendimento/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/core/api/client";
import { useAtendimentoStore } from "@/features/atendimento/store/useAtendimentoStore";
import { useAtendimentoIntegration } from "@/features/atendimento/hooks/useAtendimentoIntegration";
import { AtendimentoList } from "@/features/atendimento/components/AtendimentoList";
import { AtendimentoChatPanel } from "@/features/atendimento/components/AtendimentoChatPanel";

const POLL_INTERVAL_MS = 5000;

interface Agente {
  id: string;
  name: string;
}

export default function AtendimentoPage() {
  const atendimentos = useAtendimentoStore((state) => state.atendimentos);
  const filas = useAtendimentoStore((state) => state.filas);
  const eventos = useAtendimentoStore((state) => state.eventos);
  const mensagens = useAtendimentoStore((state) => state.mensagens);
  const selectedAtendimentoId = useAtendimentoStore((state) => state.selectedAtendimentoId);
  const setSelectedAtendimentoId = useAtendimentoStore((state) => state.setSelectedAtendimentoId);
  const isLoadingDetail = useAtendimentoStore((state) => state.isLoadingDetail);

  const {
    loadAtendimentos,
    loadFilas,
    loadAtendimentoDetail,
    handleAssign,
    handleTransfer,
    handleRequeue,
    handleClose,
    handleAddNota,
    handleEnviarMensagem,
  } = useAtendimentoIntegration();

  const [activeTab, setActiveTab] = useState("todos");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    apiRequest<{ id: string; role: string }>("/auth/me")
      .then((me) => {
        setCurrentUserId(me.id);
        setCurrentUserRole(me.role);
      })
      .catch(() => {});
    apiRequest<Agente[]>("/rh/corretores")
      .then(setAgentes)
      .catch(() => {});
    loadFilas();
    loadAtendimentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll simples (mesmo padrao ja usado em /dashboard/whatsapp) - sem
  // websocket neste modulo ainda.
  useEffect(() => {
    const interval = setInterval(() => {
      loadAtendimentos();
      if (selectedAtendimentoId) {
        loadAtendimentoDetail(selectedAtendimentoId);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAtendimentoId]);

  function handleSelect(id: string) {
    setSelectedAtendimentoId(id);
    loadAtendimentoDetail(id);
  }

  const selectedAtendimento = atendimentos.find((a) => a.id === selectedAtendimentoId) ?? null;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Central de Atendimento</h1>
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <AtendimentoList
          atendimentos={atendimentos}
          filas={filas}
          selectedId={selectedAtendimentoId}
          onSelect={handleSelect}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <AtendimentoChatPanel
          atendimento={selectedAtendimento}
          eventos={eventos}
          mensagens={mensagens}
          filas={filas}
          agentes={agentes}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          isLoading={isLoadingDetail}
          onAssign={async () => {
            if (selectedAtendimentoId) await handleAssign(selectedAtendimentoId);
          }}
          onTransfer={async (input) => {
            if (selectedAtendimentoId) await handleTransfer(selectedAtendimentoId, input);
          }}
          onRequeue={async () => {
            if (selectedAtendimentoId) await handleRequeue(selectedAtendimentoId);
          }}
          onClose={async (motivo) => {
            if (selectedAtendimentoId) await handleClose(selectedAtendimentoId, motivo);
          }}
          onAddNota={async (texto) => {
            if (selectedAtendimentoId) {
              await handleAddNota(selectedAtendimentoId, texto);
              await loadAtendimentoDetail(selectedAtendimentoId);
            }
          }}
          onSendMessage={async (body) => {
            if (selectedAtendimentoId) {
              await handleEnviarMensagem(selectedAtendimentoId, body);
              await loadAtendimentoDetail(selectedAtendimentoId);
            }
          }}
        />
      </div>
    </div>
  );
}
