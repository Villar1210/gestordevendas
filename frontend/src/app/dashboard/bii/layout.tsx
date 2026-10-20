// src/app/dashboard/bii/layout.tsx
// BII (Business Intelligence Imobiliario) - so Administrador. O guard e so
// conveniencia de tela: a protecao real e o @Roles('Administrador') do
// backend em /bii/*.
"use client";

import { SomenteAdminGuard } from "@/features/imoveis/components/SomenteAdminGuard";
import { BII_ABAS } from "@/features/bii/constants";

export default function BiiLayout({ children }: { children: React.ReactNode }) {
  return (
    <SomenteAdminGuard destino="/dashboard/inicio">
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 pt-4 sm:px-6">
          <h1 className="text-lg font-semibold text-slate-800">Business Intelligence Imobiliário</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Indicadores de vendas do CRM para decidir onde, o que e como lançar. Somente Administrador.
          </p>
          <nav aria-label="Seções do BII" className="-mx-4 mt-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            <ul className="flex gap-1">
              {BII_ABAS.map((aba) =>
                aba.disponivel ? (
                  <li key={aba.id}>
                    <span
                      aria-current="page"
                      className="block whitespace-nowrap border-b-2 border-blue-600 px-3 py-2.5 text-sm font-medium text-blue-700"
                    >
                      {aba.label}
                    </span>
                  </li>
                ) : (
                  <li key={aba.id}>
                    <span
                      aria-disabled="true"
                      title="Disponível nas próximas fatias do BII"
                      className="flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-slate-400"
                    >
                      {aba.label}
                      <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-semibold text-slate-500">
                        em breve
                      </span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </header>
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</div>
      </div>
    </SomenteAdminGuard>
  );
}
