// src/features/equipe/constants.ts
// Espelha os valores aceitos pelo backend (update-status-disponibilidade.dto.ts).

export interface StatusDisponibilidadeOption {
  value: string;
  label: string;
  // Bolinha de status: lista de corretores e seletor da Topbar.
  dotClassName: string;
}

export const STATUS_DISPONIBILIDADE_OPTIONS: StatusDisponibilidadeOption[] = [
  { value: "online", label: "Online", dotClassName: "bg-green-500" },
  { value: "ausente", label: "Ausente", dotClassName: "bg-amber-500" },
  { value: "offline", label: "Offline", dotClassName: "bg-slate-400" },
];

export function getStatusDisponibilidadeOption(status: string): StatusDisponibilidadeOption {
  return (
    STATUS_DISPONIBILIDADE_OPTIONS.find((option) => option.value === status) ??
    STATUS_DISPONIBILIDADE_OPTIONS[2]
  );
}
