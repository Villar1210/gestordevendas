// src/app/dashboard/edoc/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, FileSignature, Search } from "lucide-react";
import { useEdocStore, EnvelopeStats } from "@/features/edoc/store/useEdocStore";
import { useEdocIntegration } from "@/features/edoc/hooks/useEdocIntegration";
import { getStatusOption } from "@/features/edoc/constants";
import { CreateEnvelopeModal } from "@/features/edoc/components/CreateEnvelopeModal";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

// Abas de filtro (Fatia 4) - "Todos" nao manda status nenhum ao backend.
const FILTER_TABS: { label: string; status?: string }[] = [
  { label: "Todos" },
  { label: "Rascunho", status: "rascunho" },
  { label: "Enviados", status: "aguardando_assinaturas" },
  { label: "Concluidos", status: "concluido" },
  { label: "Cancelados", status: "cancelado" },
];

const STATS_CARDS: { key: keyof EnvelopeStats; label: string }[] = [
  { key: "total", label: "Total de Envelopes" },
  { key: "aguardando_assinaturas", label: "Aguardando Assinatura" },
  { key: "concluido", label: "Concluidos" },
  { key: "rascunho", label: "Rascunhos" },
];

export default function EdocPage() {
  const envelopes = useEdocStore((state) => state.envelopes);
  const isLoading = useEdocStore((state) => state.isLoading);
  const openCreateModal = useEdocStore((state) => state.openCreateModal);
  const openEditModal = useEdocStore((state) => state.openEditModal);
  const { loadEnvelopes, loadStats } = useEdocIntegration();
  const hasInitialized = useRef(false);
  const router = useRouter();

  const [stats, setStats] = useState<EnvelopeStats | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");

  async function refreshStats() {
    setStats(await loadStats());
  }

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadEnvelopes();
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflete criacao/envio/cancelamento de envelopes (Fatia 4) - a store
  // atualiza "envelopes" em varios pontos (addEnvelope/updateEnvelopeInPlace
  // no hook), entao observar essa lista e mais simples/confiavel do que
  // chamar refreshStats() manualmente em cada acao do modal.
  useEffect(() => {
    if (!hasInitialized.current) return;
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopes]);

  // Busca com um pequeno debounce para nao disparar 1 requisicao por tecla.
  useEffect(() => {
    if (!hasInitialized.current) return;
    const timeout = setTimeout(() => {
      loadEnvelopes({ status: FILTER_TABS[activeTab].status, search: search.trim() || undefined });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, search]);

  function handleRowClick(envelope: { id: string; status: string }) {
    if (envelope.status === "rascunho") {
      openEditModal(envelope.id);
    } else {
      router.push(`/dashboard/edoc/${envelope.id}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-800">E-doc</h1>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          <Plus className="h-4 w-4" /> Novo Envelope
        </button>
      </header>

      <div className="p-6">
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS_CARDS.map((card) => (
            <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">
                {stats ? stats[card.key] : "-"}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {FILTER_TABS.map((tab, index) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(index)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  activeTab === index
                    ? "bg-blue-700 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por titulo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm">Carregando envelopes...</p>
          </div>
        ) : envelopes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <FileSignature className="h-8 w-8" />
            <p className="text-sm">Nenhum envelope encontrado.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Titulo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Assinantes</th>
                  <th className="px-4 py-3 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {envelopes.map((envelope) => {
                  const statusOption = getStatusOption(envelope.status);
                  return (
                    <tr
                      key={envelope.id}
                      onClick={() => handleRowClick(envelope)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{envelope.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}
                        >
                          {statusOption.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{envelope.recipientsCount}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {dateFormatter.format(new Date(envelope.createdAt))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateEnvelopeModal />
    </div>
  );
}
