// src/app/dashboard/redes-sociais/page.tsx
// Placeholder da Fatia 1 do modulo Redes Sociais (agendamento e
// publicacao em redes sociais tipo mLabs/Zoho Social) - so a modelagem
// Prisma + este item de menu existem por enquanto. Compositor, calendario,
// contas conectadas e analytics entram em fatias futuras.
import { Share2 } from "lucide-react";

export default function RedesSociaisPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="rounded-full bg-blue-50 p-4">
        <Share2 className="h-8 w-8 text-blue-600" />
      </div>
      <h1 className="text-xl font-semibold text-slate-800">Redes Sociais</h1>
      <p className="max-w-md text-sm text-slate-500">
        Modulo em construcao. Em breve voce podera agendar e publicar posts em Instagram, Facebook e
        outras redes sociais diretamente por aqui.
      </p>
    </div>
  );
}
