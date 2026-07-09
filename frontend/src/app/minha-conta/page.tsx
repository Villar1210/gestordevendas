// src/app/minha-conta/page.tsx
// Destino pos-login para roles sem acesso ao dashboard interno (Cliente,
// Imobiliaria Parceira) - ver DASHBOARD_ROLES. Pagina fora do layout do
// dashboard, de proposito: nao faz nenhuma chamada a API que exigiria
// role de dashboard (Sidebar/Topbar nao sao renderizados aqui).
"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, LogOut } from "lucide-react";
import { TOKEN_STORAGE_KEY, STATUS_DISPONIBILIDADE_STORAGE_KEY } from "@/core/api/client";

export default function MinhaContaPage() {
  const router = useRouter();

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
        <h1 className="mb-2 text-xl font-semibold text-slate-800">Sua conta foi aprovada!</h1>
        <p className="mb-6 text-sm text-slate-500">
          Em breve teremos uma area exclusiva para voce.
        </p>
        <button
          onClick={handleLogout}
          className="mx-auto flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
