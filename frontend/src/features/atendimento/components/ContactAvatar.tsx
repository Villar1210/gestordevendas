// src/features/atendimento/components/ContactAvatar.tsx
// Avatar circular do contato (lead/cliente via WhatsApp) - antes mostrava os
// 2 primeiros digitos do telefone (initialsFromPhone, nao comunicava nada
// util). Atendimento nao tem campo de nome de contato no backend hoje (ver
// useAtendimentoStore.ts) - por isso `name` e opcional e o fallback (icone
// generico de contato) e o caminho normal agora; iniciais reais entram em
// uso automaticamente no dia em que esse campo existir, sem precisar mexer
// nos componentes que usam este avatar.
import { User } from "lucide-react";
import { initialsFromName } from "../format";

const SIZE_CLASSES = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
} as const;

const ICON_SIZE = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
} as const;

interface ContactAvatarProps {
  name?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function ContactAvatar({ name, size = "md", className = "" }: ContactAvatarProps) {
  const trimmedName = name?.trim();
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-blue-100 font-semibold text-blue-700 ${SIZE_CLASSES[size]} ${className}`}
    >
      {trimmedName ? initialsFromName(trimmedName) : <User className={ICON_SIZE[size]} strokeWidth={2} />}
    </span>
  );
}
