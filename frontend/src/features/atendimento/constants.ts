// src/features/atendimento/constants.ts
// Espelha os valores aceitos pelo backend (Atendimento.status,
// AtendimentoEvento.tipo).

export interface StatusOption {
  value: string;
  label: string;
  badgeClassName: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: "aguardando", label: "Aguardando", badgeClassName: "bg-slate-100 text-slate-700" },
  {
    value: "em_atendimento",
    label: "Em Atendimento",
    badgeClassName: "bg-blue-100 text-blue-700",
  },
  { value: "fechado", label: "Fechado", badgeClassName: "bg-green-100 text-green-700" },
];

export function getStatusOption(status: string): StatusOption {
  return STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];
}

export const EVENTO_TIPO_LABELS: Record<string, string> = {
  criado: "Criado",
  atribuido: "Assumiu o atendimento",
  transferido: "Transferido",
  devolvido: "Devolvido para a fila",
  fechado: "Fechado",
  nota: "Nota",
};
