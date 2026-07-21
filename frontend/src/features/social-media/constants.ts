// src/features/social-media/constants.ts
// Espelha os valores aceitos pelo backend (Canal enum e
// SocialAccount.status) - frontend e backend sao projetos separados, sem
// compartilhamento de codigo, mesmo padrao ja usado em features/edoc/constants.ts.

export interface CanalOption {
  value: string;
  label: string;
  badgeClassName: string;
}

export const CANAL_OPTIONS: CanalOption[] = [
  { value: "FACEBOOK", label: "Facebook", badgeClassName: "bg-blue-100 text-blue-700" },
  { value: "INSTAGRAM", label: "Instagram", badgeClassName: "bg-pink-100 text-pink-700" },
  { value: "LINKEDIN", label: "LinkedIn", badgeClassName: "bg-sky-100 text-sky-700" },
  { value: "TIKTOK", label: "TikTok", badgeClassName: "bg-slate-200 text-slate-800" },
  { value: "YOUTUBE", label: "YouTube", badgeClassName: "bg-red-100 text-red-700" },
];

export function getCanalOption(canal: string): CanalOption {
  return (
    CANAL_OPTIONS.find((option) => option.value === canal) ?? {
      value: canal,
      label: canal,
      badgeClassName: "bg-slate-100 text-slate-700",
    }
  );
}

export interface StatusOption {
  value: string;
  label: string;
  badgeClassName: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: "CONNECTED", label: "Conectada", badgeClassName: "bg-green-100 text-green-700" },
  { value: "EXPIRED", label: "Token expirado", badgeClassName: "bg-amber-100 text-amber-700" },
  { value: "ERROR", label: "Erro", badgeClassName: "bg-red-100 text-red-700" },
  { value: "DISCONNECTED", label: "Desconectada", badgeClassName: "bg-slate-100 text-slate-500" },
];

export function getStatusOption(status: string): StatusOption {
  return STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];
}
