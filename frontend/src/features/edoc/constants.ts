// src/features/edoc/constants.ts
// Espelha os valores aceitos pelo backend (SignatureEnvelope.status).

export interface StatusOption {
  value: string;
  label: string;
  badgeClassName: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: "rascunho", label: "Rascunho", badgeClassName: "bg-slate-100 text-slate-700" },
  {
    value: "aguardando_assinaturas",
    label: "Aguardando Assinaturas",
    badgeClassName: "bg-amber-100 text-amber-700",
  },
  { value: "concluido", label: "Concluido", badgeClassName: "bg-green-100 text-green-700" },
  { value: "cancelado", label: "Cancelado", badgeClassName: "bg-red-100 text-red-700" },
];

export function getStatusOption(status: string): StatusOption {
  return STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];
}
