// src/app/dashboard/atendimento/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/core/api/client";
import { useAtendimentoStore } from "@/features/atendimento/store/useAtendimentoStore";
import { useAtendimentoIntegration } from "@/features/atendimento/hooks/useAtendimentoIntegration";
import { AtendimentoList } from "@/features/atendimento/components/AtendimentoList";
import { AtendimentoChatPanel } from "@/features/atendimento/components/AtendimentoChatPanel";
import { AtendimentoTab } from "@/features/atendimento/constants";
import { PlantaoStatusBadge } from "@/features/plantao/components/PlantaoStatusBadge";
import { Headset } from "lucide-react";

const POLL_INTERVAL_MS = 5000;

interface Agente {
  id: string;
  name: string;
  statusDisponibilidade: string;
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

  const [activeTab, setActiveTab] = useState<AtendimentoTab>("todos");
  const [filaFilter, setFilaFilter] = useState("todas");
  const [corretorFilter, setCorretorFilter] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const hasInitialized = useRef(false);

  function loadAgentes() {
    return apiRequest<Agente[]>("/rh/corretores")
      .then(setAgentes)
      .catch(() => {});
  }

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    apiRequest<{ id: string; role: string }>("/auth/me")
      .then((me) => {
        setCurrentUserId(me.id);
        setCurrentUserRole(me.role);
      })
      .catch(() => {});
    loadAgentes();
    loadFilas();
    loadAtendimentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll simples (mesmo padrao ja usado em /dashboard/whatsapp) - sem
  // websocket neste modulo ainda. /rh/corretores entrou no mesmo intervalo
  // (antes so era buscado 1x no mount) para o painel de "quem esta online"
  // refletir mudancas de status quase em tempo real.
  useEffect(() => {
    const interval = setInterval(() => {
      loadAtendimentos();
      loadAgentes();
      if (selectedAtendimentoId) {
        // silent=true: atualizacao em segundo plano, nao aciona o spinner
        // de carregamento (ver comentario em useAtendimentoIntegration).
        loadAtendimentoDetail(selectedAtendimentoId, true);
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

  // Historico do numero: sem endpoint dedicado no backend nesta fatia -
  // filtra client-side a partir da lista completa ja carregada em memoria.
  const historico = useMemo(() => {
    if (!selectedAtendimento) return [];
    return atendimentos.filter(
      (a) => a.phoneNumber === selectedAtendimento.phoneNumber && a.id !== selectedAtendimento.id,
    );
  }, [atendimentos, selectedAtendimento]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <Headset className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Central de Atendimento</h1>
        </div>
        <PlantaoStatusBadge />
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <AtendimentoList
          atendimentos={atendimentos}
          filas={filas}
          agentes={agentes}
          selectedId={selectedAtendimentoId}
          onSelect={handleSelect}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filaFilter={filaFilter}
          onFilaFilterChange={setFilaFilter}
          corretorFilter={corretorFilter}
          onCorretorFilterChange={setCorretorFilter}
          onQuickAssign={handleAssign}
          onQuickTransfer={handleTransfer}
          onQuickRequeue={handleRequeue}
          onQuickClose={handleClose}
        />
        <AtendimentoChatPanel
          atendimento={selectedAtendimento}
          eventos={eventos}
          mensagens={mensagens}
          filas={filas}
          agentes={agentes}
          historico={historico}
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
