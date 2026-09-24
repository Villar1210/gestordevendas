// src/components/layout/DashboardShell.tsx
"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ImpersonationBanner } from "./ImpersonationBanner";

// Casca do dashboard. Guarda o estado do menu lateral no celular:
// no desktop (md+) o Sidebar fica sempre visivel; abaixo disso ele vira
// uma gaveta aberta pelo botao de menu do Topbar.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar open={menuAberto} onClose={() => setMenuAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <Topbar onOpenMenu={() => setMenuAberto(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
