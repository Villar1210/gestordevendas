// src/features/dashboard-corretor/constants.ts
// Badge de origem especifico do Dashboard do Corretor - cores/rotulos
// combinados com o usuario para este contexto (diferentes dos usados no
// badge de origem do proprio Card no Kanban, ver KanbanCard.tsx - mesmo
// campo Card.origem, apresentacao propria por tela). "manual" nao aparece
// aqui de proposito: e o caso mais comum ("+ Novo Negocio" do proprio
// corretor) e nao leva badge nenhum.
export interface OrigemBadgeOption {
  label: string;
  className: string;
}

export const ORIGEM_BADGE_OPTIONS: Record<string, OrigemBadgeOption> = {
  vivi_repique: { label: "VIVI", className: "bg-blue-100 text-blue-700" },
  roleta_online: { label: "Roleta", className: "bg-green-100 text-green-700" },
  webhook: { label: "Web", className: "bg-slate-200 text-slate-600" },
};

export function getOrigemBadgeOption(origem: string): OrigemBadgeOption | null {
  return ORIGEM_BADGE_OPTIONS[origem] ?? null;
}
