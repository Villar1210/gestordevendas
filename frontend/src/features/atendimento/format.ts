// src/features/atendimento/format.ts
// Helpers de formatacao compartilhados entre AtendimentoList e AtendimentoChatPanel.

const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return relativeFormatter.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return relativeFormatter.format(diffDay, "day");
}

// Atendimento nao tem campo de nome de contato no backend hoje (so
// phoneNumber) - a exibicao sempre cai no telefone formatado
// (BR: +55 (DDD) 9XXXX-XXXX quando reconhece o padrao, cru caso contrario).
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const splitAt = rest.length === 9 ? 5 : 4;
    return `+55 (${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`;
  }
  return phone;
}

// Iniciais a partir do NOME (1a letra do 1o + do ultimo nome) - usado pelo
// avatar de agente/contato quando ha um nome real disponivel (ver
// ContactAvatar.tsx). Movido de AtendimentoList.tsx (era local la) para
// virar compartilhado entre os avatares de agente e de contato.
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Separador de dia no corpo do chat: "Hoje" / "Ontem" / "DD/MM/AAAA".
const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDayHeader(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return dayFormatter.format(date);
}
