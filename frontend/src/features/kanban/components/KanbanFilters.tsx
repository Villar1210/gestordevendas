// src/features/kanban/components/KanbanFilters.tsx
"use client";

import { Search } from "lucide-react";
import {
  useKanbanStore,
  TemperatureFilter,
  OrigemFilter,
} from "../store/useKanbanStore";

export function KanbanFilters() {
  const searchTerm = useKanbanStore((state) => state.searchTerm);
  const setSearchTerm = useKanbanStore((state) => state.setSearchTerm);
  const temperatureFilter = useKanbanStore((state) => state.temperatureFilter);
  const setTemperatureFilter = useKanbanStore((state) => state.setTemperatureFilter);
  const origemFilter = useKanbanStore((state) => state.origemFilter);
  const setOrigemFilter = useKanbanStore((state) => state.setOrigemFilter);

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3">
      <div className="relative w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por titulo..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
      </div>

      <select
        value={temperatureFilter}
        onChange={(e) => setTemperatureFilter(e.target.value as TemperatureFilter)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
      >
        <option value="all">Todas as temperaturas</option>
        <option value="quente">🔥 Quente</option>
        <option value="morno">☀️ Morno</option>
        <option value="frio">❄️ Frio</option>
      </select>

      <select
        value={origemFilter}
        onChange={(e) => setOrigemFilter(e.target.value as OrigemFilter)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
      >
        <option value="all">Todas as origens</option>
        <option value="manual">Manual</option>
        <option value="webhook">Webhook</option>
        <option value="roleta_online">Roleta Online</option>
      </select>
    </div>
  );
}
