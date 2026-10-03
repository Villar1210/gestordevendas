// src/app/dashboard/whatsapp/page.tsx
// Fatia 3 (WhatsApp do corretor): a tela passa a ter duas abas.
// - "Leads da VIVI" (todos): o corretor vê os leads que a VIVI passou para
//   ele, lê a conversa da VIVI e continua pelo próprio WhatsApp.
// - "Conexão do número" (só Administrador): a antiga tela de QR/status do
//   número da imobiliária (ver features/whatsapp/components/ConexaoWhatsApp).
// Identidade visual verde continua sendo exceção isolada a esta tela.
"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { LeadsViviPanel } from "@/features/whatsapp/components/LeadsViviPanel";
import { ConexaoWhatsApp } from "@/features/whatsapp/components/ConexaoWhatsApp";

type Aba = "leads" | "conexao";

export default function WhatsAppPage() {
  const [me, setMe] = useState<{ id: string; name: string; role: string } | null>(null);
  const [aba, setAba] = useState<Aba>("leads");

  useEffect(() => {
    apiRequest<{ id: string; name: string; role: string }>("/auth/me").then(setMe).catch(() => {});
  }, []);

  const ehAdmin = me?.role === "Administrador";

  return (
    <div className="flex h-full min-h-screen flex-col bg-gradient-to-b from-emerald-50/60 to-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/10">
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">WhatsApp</h1>
            <p className="text-xs text-slate-500">Continue no seu WhatsApp os atendimentos que a VIVI começou.</p>
          </div>
        </div>
        {ehAdmin && (
          <nav className="flex rounded-lg bg-slate-100 p-1 text-sm" aria-label="Abas do WhatsApp">
            {(
              [
                ["leads", "Leads da VIVI"],
                ["conexao", "Conexão do número"],
              ] as Array<[Aba, string]>
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                onClick={() => setAba(valor)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  aba === valor ? "bg-white text-[#0F7A3D] shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </nav>
        )}
      </header>

      {aba === "conexao" && ehAdmin ? <ConexaoWhatsApp /> : <LeadsViviPanel me={me} />}
    </div>
  );
}
