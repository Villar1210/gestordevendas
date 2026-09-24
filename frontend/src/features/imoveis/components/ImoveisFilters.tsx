// src/features/imoveis/components/ImoveisFilters.tsx
"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { useImoveisStore, type FinalidadeFilter } from "@/features/imoveis/store/useImoveisStore";
import { TIPO_OPTIONS, FINALIDADE_OPTIONS, STATUS_OPTIONS } from "@/features/imoveis/constants";

interface ImoveisFiltersProps {
  tipoFilter: string;
  setTipoFilter: (v: string) => void;
  bedroomsFilter: string;
  setBedroomsFilter: (v: string) => void;
  minPrice: string;
  setMinPrice: (v: string) => void;
  maxPrice: string;
  setMaxPrice: (v: string) => void;
}

export function ImoveisFilters({
  tipoFilter,
  setTipoFilter,
  bedroomsFilter,
  setBedroomsFilter,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
}: ImoveisFiltersProps) {
  const busca = useImoveisStore((state) => state.busca);
  const setBusca = useImoveisStore((state) => state.setBusca);
  const finalidadeFilter = useImoveisStore((state) => state.finalidadeFilter);
  const setFinalidadeFilter = useImoveisStore((state) => state.setFinalidadeFilter);
  const statusFilter = useImoveisStore((state) => state.statusFilter);
  const setStatusFilter = useImoveisStore((state) => state.setStatusFilter);
  const empreendimentoFilter = useImoveisStore((state) => state.empreendimentoFilter);
  const setEmpreendimentoFilter = useImoveisStore((state) => state.setEmpreendimentoFilter);
  const empreendimentos = useImoveisStore((state) => state.empreendimentos);

  const [showExtra, setShowExtra] = useState(false);

  const hasAnyFilter =
    busca !== "" ||
    finalidadeFilter !== "all" ||
    statusFilter !== "all" ||
    empreendimentoFilter !== "all" ||
    tipoFilter !== "all" ||
    bedroomsFilter !== "all" ||
    minPrice !== "" ||
    maxPrice !== "";

  function clearAll() {
    setBusca("");
    setFinalidadeFilter("all");
    setStatusFilter("all");
    setEmpreendimentoFilter("all");
    setTipoFilter("all");
    setBedroomsFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setShowExtra(false);
  }

  return (
    <div className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar imovel..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
        </div>

        <select
          value={finalidadeFilter}
          onChange={(e) => setFinalidadeFilter(e.target.value as FinalidadeFilter)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todas finalidades</option>
          {FINALIDADE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos os tipos</option>
          {TIPO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={bedroomsFilter}
          onChange={(e) => setBedroomsFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Quartos</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
        </select>

        <button
          onClick={() => setShowExtra((v) => !v)}
          className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
            showExtra
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Mais filtros
        </button>

        {hasAnyFilter && (
          <button
            onClick={clearAll}
            className="flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-slate-500 hover:text-slate-700"
          >
            <X className="h-4 w-4" /> Limpar
          </button>
        )}
      </div>

      {showExtra && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={empreendimentoFilter}
            onChange={(e) => setEmpreendimentoFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os empreendimentos</option>
            {empreendimentos.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Preco min (R$)"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="h-9 w-36 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="number"
            placeholder="Preco max (R$)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="h-9 w-36 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
