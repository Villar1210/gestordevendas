// src/features/bii/components/EmptyState.tsx
import type { LucideIcon } from "lucide-react";
import { SearchX } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  titulo: string;
  texto?: string;
  acao?: { label: string; onClick: () => void };
  compacto?: boolean;
}

export function EmptyState({ icon: Icon = SearchX, titulo, texto, acao, compacto = false }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compacto ? "gap-1 py-8" : "gap-2 py-14"}`}
    >
      <Icon className="h-7 w-7 text-slate-300" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-slate-500">{texto}</p>}
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {acao.label}
        </button>
      )}
    </div>
  );
}
