// src/features/kanban/components/OwnerAvatar.tsx
// Avatar circular do corretor/dono do card - iniciais extraidas do nome
// Tamanho padrao: 24x24px para exibicao compacta no card
import { User } from "lucide-react";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface OwnerAvatarProps {
  name?: string | null;
  className?: string;
}

export function OwnerAvatar({ name, className = "" }: OwnerAvatarProps) {
  const trimmedName = name?.trim();
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 ${className}`}
      title={trimmedName || "Sem dono"}
    >
      {trimmedName ? initialsFromName(trimmedName) : <User className="h-3 w-3" strokeWidth={2} />}
    </span>
  );
}
