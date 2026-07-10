// src/features/imoveis/components/ImoveisFilters.tsx
"use client";

import { Search } from "lucide-react";
import { useImoveisStore, FinalidadeFilter } from "../store/useImoveisStore";
import { FINALIDADE_OPTIONS, STATUS_OPTIONS } from "../constants";

export function ImoveisFilters() {
  const busca = useImoveisStore((state) => state.busca);
  const setBusca = useImoveisStore((state) => state.setBusca);
  const finalidadeFilter = useImoveisStore((state) => state.finalidadeFilter);
  const setFinalidadeFilter = useImoveisStore((state) => state.setFinalidadeFilter);
  const statusFilter = useImoveisStore((state) => state.statusFilter);
  const setStatusFilter = useImoveisStore((state) => state.setStatusFilter);
  const empreendimentoFilter = useImoveisStore((state) => state.empreendimentoFilter);
  const setEmpreendimentoFilter = useImoveisStore((state) => state.setEmpreendimentoFilter);
  const empreendimentos = useImoveisStore((state) => state.empreendimentos);

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3">
      <div className="relative w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por titulo..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
      </div>

      <select
        value={finalidadeFilter}
        onChange={(e) => setFinalidadeFilter(e.target.value as FinalidadeFilter)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
      >
        <option value="all">Todas as finalidades</option>
        {FINALIDADE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
      >
        <option value="all">Todos os status</option>
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={empreendimentoFilter}
        onChange={(e) => setEmpreendimentoFilter(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
      >
        <option value="all">Todos os empreendimentos</option>
        {empreendimentos.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.name}
          </option>
        ))}
      </select>
    </div>
  );
}
