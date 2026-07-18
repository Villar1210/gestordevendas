// src/app/super-usuario/page.tsx
// Tela do dono da plataforma SaaS - lista todos os tenants clientes e
// permite "entrar como Administrador" de qualquer um (impersonacao, ver
// ImpersonarTenantUseCase no backend), alem do historico de auditoria dos
// proprios acessos (Fatia 3). Fora do layout do dashboard normal (sem
// Sidebar/Topbar) - mesmo padrao de /minha-conta - ja que Super Usuario
// nunca acessa o dashboard normal.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Loader2, LogIn, History } from "lucide-react";
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

interface AcessoPlataformaLog {
  id: string;
  tenantNome: string;
  createdAt: string;
}

type ActiveView = "tenants" | "historico";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function SuperUsuarioPage() {
  const router = useRouter();
  const hasInitialized = useRef(false);

  const [activeView, setActiveView] = useState<ActiveView>("tenants");
  const [isLoading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [entrandoTenantId, setEntrandoTenantId] = useState<string | null>(null);

  const [historico, setHistorico] = useState<AcessoPlataformaLog[]>([]);
  const [historicoLoaded, setHistoricoLoaded] = useState(false);

  // Confirmacao extra ao impersonar: exige digitar o nome exato do
  // tenant antes de liberar o botao "Confirmar" - impersonacao e uma
  // acao poderosa demais pra depender so de 1 clique.
  const [confirmandoTenant, setConfirmandoTenant] = useState<TenantSummary | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

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

  function loadHistorico() {
    apiRequest<AcessoPlataformaLog[]>("/super-usuario/meus-acessos")
      .then(setHistorico)
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar o historico.");
      })
      .finally(() => setHistoricoLoaded(true));
  }

  function handleSelectView(view: ActiveView) {
    setActiveView(view);
    if (view === "historico" && !historicoLoaded) {
      loadHistorico();
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    window.localStorage.removeItem(IMPERSONANDO_TENANT_NOME_STORAGE_KEY);
    router.push("/login");
  }

  function abrirConfirmacao(tenant: TenantSummary) {
    setConfirmandoTenant(tenant);
    setConfirmInput("");
  }

  function fecharConfirmacao() {
    setConfirmandoTenant(null);
    setConfirmInput("");
  }

  async function handleConfirmarEntrada() {
    if (!confirmandoTenant) return;
    const tenant = confirmandoTenant;
    setEntrandoTenantId(tenant.id);
    fecharConfirmacao();
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

  const confirmacaoValida = confirmandoTenant !== null && confirmInput === confirmandoTenant.name;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-slate-800">Gestao de Tenants</span>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => handleSelectView("tenants")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "tenants"
                  ? "bg-blue-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Tenants
            </button>
            <button
              onClick={() => handleSelectView("historico")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === "historico"
                  ? "bg-blue-700 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Meus Acessos
            </button>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </header>

      <div className="p-6">
        {activeView === "tenants" ? (
          isLoading ? (
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
                          onClick={() => abrirConfirmacao(tenant)}
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
          )
        ) : !historicoLoaded ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm">Carregando historico...</p>
          </div>
        ) : historico.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <History className="h-8 w-8" />
            <p className="text-sm">Nenhum acesso registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tenant acessado</th>
                  <th className="px-4 py-3 font-medium">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historico.map((acesso) => (
                  <tr key={acesso.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{acesso.tenantNome}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {dateFormatter.format(new Date(acesso.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmandoTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Confirmar impersonacao</h2>
            <p className="mb-4 text-sm text-slate-500">
              Voce esta prestes a entrar como Administrador de{" "}
              <strong>{confirmandoTenant.name}</strong>. Pra confirmar, digite o nome exato do
              tenant abaixo.
            </p>
            <input
              autoFocus
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmandoTenant.name}
              className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={fecharConfirmacao}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEntrada}
                disabled={!confirmacaoValida}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
