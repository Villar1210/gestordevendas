// src/features/atendimento/components/AtendimentoList.tsx
"use client";

import { useMemo, useState } from "react";
import { Search, Inbox } from "lucide-react";
import { Atendimento, Fila } from "../store/useAtendimentoStore";
import { getStatusOption } from "../constants";

const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return relativeFormatter.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return relativeFormatter.format(diffDay, "day");
}

interface AtendimentoListProps {
  atendimentos: (Atendimento & { lastMessageBody?: string | null; lastMessageAt?: string | null })[];
  filas: Fila[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AtendimentoList({
  atendimentos,
  filas,
  selectedId,
  onSelect,
  activeTab,
  onTabChange,
}: AtendimentoListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = atendimentos;
    if (activeTab === "nao_classificado") {
      list = list.filter((a) => !a.filaId);
    } else if (activeTab !== "todos") {
      list = list.filter((a) => a.filaId === activeTab);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((a) => a.phoneNumber.toLowerCase().includes(term));
    }
    return list;
  }, [atendimentos, activeTab, search]);

  return (
    <div className="flex w-96 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 p-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por numero..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2">
        <button
          onClick={() => onTabChange("todos")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
            activeTab === "todos" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => onTabChange("nao_classificado")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
            activeTab === "nao_classificado"
              ? "bg-blue-700 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Nao Classificados
        </button>
        {filas.map((fila) => (
          <button
            key={fila.id}
            onClick={() => onTabChange(fila.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
              activeTab === fila.id
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {fila.nome}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            <Inbox className="h-6 w-6" />
            <p className="text-sm">Nenhum atendimento aqui.</p>
          </div>
        ) : (
          filtered.map((atendimento) => {
            const statusOption = getStatusOption(atendimento.status);
            const isSelected = atendimento.id === selectedId;
            return (
              <button
                key={atendimento.id}
                onClick={() => onSelect(atendimento.id)}
                className={`flex w-full flex-col gap-1 border-b border-slate-50 px-4 py-3 text-left transition ${
                  isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">
                    {atendimento.phoneNumber}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {formatRelativeTime(atendimento.lastMessageAt ?? atendimento.updatedAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">
                  {atendimento.lastMessageBody || "Sem mensagens ainda"}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusOption.badgeClassName}`}
                  >
                    {statusOption.label}
                  </span>
                  {atendimento.filaNome && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {atendimento.filaNome}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
