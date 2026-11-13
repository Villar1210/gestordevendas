// src/app/dashboard/campanhas/layout.tsx
// Campanhas por SMS - so Administrador. O guard e conveniencia de tela: a
// protecao real e o @Roles('Administrador') do backend em /campanhas-sms.
"use client";

import { SomenteAdminGuard } from "@/features/imoveis/components/SomenteAdminGuard";

export default function CampanhasLayout({ children }: { children: React.ReactNode }) {
  return (
    <SomenteAdminGuard destino="/dashboard/inicio">
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold text-slate-800">Campanhas por SMS</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Repique em massa com link único por pessoa, descadastro automático (SAIR) e relatório de cliques e respostas.
          </p>
        </header>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </SomenteAdminGuard>
  );
}
