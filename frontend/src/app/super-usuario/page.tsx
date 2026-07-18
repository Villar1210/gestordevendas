// src/app/super-usuario/page.tsx
// Tela do dono da plataforma SaaS - lista todos os tenants clientes e
// permite "entrar como Administrador" de qualquer um (impersonacao, ver
// ImpersonarTenantUseCase no backend). Fora do layout do dashboard normal
// (sem Sidebar/Topbar) - mesmo padrao de /minha-conta - ja que Super
// Usuario nunca acessa o dashboard normal.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Loader2, LogIn } from "lucide-react";
import {
  apiRequest,
  ApiError,
  TOKEN_STORAGE_KEY,
  STATUS_DISPONIBILIDADE_STORAGE_KEY,
  IMPERSONANDO_TENANT_NOME_STORAGE_KEY,
} from "@/core/api/client";

interface TenantSummary {
  id: string;
  name: string;
  cnpj: string | null;
  createdAt: string;
  totalUsuarios: number;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default function SuperUsuarioPage() {
  const router = useRouter();
  const hasInitialized = useRef(false);

  const [isLoading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [entrandoTenantId, setEntrandoTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      router.replace("/login");
      return;
    }

    apiRequest<TenantSummary[]>("/super-usuario/tenants")
      .then(setTenants)
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar os tenants.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    window.localStorage.removeItem(IMPERSONANDO_TENANT_NOME_STORAGE_KEY);
    router.push("/login");
  }

  async function handleEntrarComoAdministrador(tenant: TenantSummary) {
    setEntrandoTenantId(tenant.id);
    try {
      const result = await apiRequest<{ token: string; tenantNome: string }>(
        `/super-usuario/tenants/${tenant.id}/impersonate`,
        { method: "POST" },
      );
      window.localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
      window.localStorage.setItem(IMPERSONANDO_TENANT_NOME_STORAGE_KEY, result.tenantNome);
      router.push("/dashboard/kanban");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel entrar neste tenant.");
      setEntrandoTenantId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <span className="text-lg font-semibold text-slate-800">Gestao de Tenants</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </header>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm">Carregando tenants...</p>
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <Building2 className="h-8 w-8" />
            <p className="text-sm">Nenhum tenant cadastrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">CNPJ</th>
                  <th className="px-4 py-3 font-medium">Criado em</th>
                  <th className="px-4 py-3 font-medium">Usuarios</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{tenant.name}</td>
                    <td className="px-4 py-3 text-slate-500">{tenant.cnpj ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {dateFormatter.format(new Date(tenant.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{tenant.totalUsuarios}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEntrarComoAdministrador(tenant)}
                        disabled={entrandoTenantId === tenant.id}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-60"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        {entrandoTenantId === tenant.id ? "Entrando..." : "Entrar como Administrador"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
