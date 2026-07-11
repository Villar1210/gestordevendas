// src/features/edoc/constants.ts
// Espelha os valores aceitos pelo backend (SignatureEnvelope.status,
// SignatureRecipient.role, SignatureField.tipo).

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

// Papel do participante (Fatia 3) - cada papel tem sua propria cor,
// mantida consistente entre o wizard de criacao, o editor de posicionamento
// e o detalhe do envelope. Testemunha em amber e uma cor semantica de
// papel (mesma familia dos badges de status), nao um elemento de marca.
export interface RoleOption {
  value: string;
  label: string;
  description: string;
  badgeClassName: string;
  cardBorderClassName: string;
  buttonClassName: string;
  dotClassName: string;
  fieldBorderClassName: string;
  fieldBgClassName: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "destinatario",
    label: "Destinatario",
    description: "Assina o documento",
    badgeClassName: "bg-blue-100 text-blue-700",
    cardBorderClassName: "border-blue-200 bg-blue-50/50",
    buttonClassName: "text-blue-600 hover:underline",
    dotClassName: "bg-blue-600",
    fieldBorderClassName: "border-blue-600",
    fieldBgClassName: "bg-blue-400/20 text-blue-800",
  },
  {
    value: "remetente",
    label: "Remetente",
    description: "Assina apos destinatarios",
    badgeClassName: "bg-green-100 text-green-700",
    cardBorderClassName: "border-green-200 bg-green-50/50",
    buttonClassName: "text-green-600 hover:underline",
    dotClassName: "bg-green-600",
    fieldBorderClassName: "border-green-600",
    fieldBgClassName: "bg-green-400/20 text-green-800",
  },
  {
    value: "testemunha",
    label: "Testemunha",
    description: "Assina por ultimo",
    badgeClassName: "bg-amber-100 text-amber-700",
    cardBorderClassName: "border-amber-200 bg-amber-50/50",
    buttonClassName: "text-amber-600 hover:underline",
    dotClassName: "bg-amber-600",
    fieldBorderClassName: "border-amber-600",
    fieldBgClassName: "bg-amber-400/20 text-amber-800",
  },
];

export function getRoleOption(role: string): RoleOption {
  return ROLE_OPTIONS.find((option) => option.value === role) ?? ROLE_OPTIONS[0];
}

// Tipo de campo (Fatia 3): assinatura completa (retangulo maior, tipicamente
// so na ultima pagina) ou rubrica (quadrado menor, repetida em todas as
// paginas - ver CLAUDE.md, regra do campo: testemunha nunca tem rubrica).
export const FIELD_TIPO_DEFAULTS = {
  assinatura: { widthPercent: 0.25, heightPercent: 0.08 },
  rubrica: { widthPercent: 0.12, heightPercent: 0.05 },
} as const;
