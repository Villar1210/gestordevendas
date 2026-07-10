// src/app/dashboard/edoc/page.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, FileSignature } from "lucide-react";
import { useEdocStore } from "@/features/edoc/store/useEdocStore";
import { useEdocIntegration } from "@/features/edoc/hooks/useEdocIntegration";
import { getStatusOption } from "@/features/edoc/constants";
import { CreateEnvelopeModal } from "@/features/edoc/components/CreateEnvelopeModal";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default function EdocPage() {
  const envelopes = useEdocStore((state) => state.envelopes);
  const isLoading = useEdocStore((state) => state.isLoading);
  const openCreateModal = useEdocStore((state) => state.openCreateModal);
  const { loadEnvelopes } = useEdocIntegration();
  const hasInitialized = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadEnvelopes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm">Carregando envelopes...</p>
          </div>
        ) : envelopes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <FileSignature className="h-8 w-8" />
            <p className="text-sm">Nenhum envelope criado ainda.</p>
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
                      onClick={() => router.push(`/dashboard/edoc/${envelope.id}`)}
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
