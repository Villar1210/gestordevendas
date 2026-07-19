// src/app/dashboard/rh/aprovacoes/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, UserCheck, FileSignature, ExternalLink } from "lucide-react";
import { useAprovacoesStore } from "@/features/aprovacoes/store/useAprovacoesStore";
import { useAprovacoesIntegration } from "@/features/aprovacoes/hooks/useAprovacoesIntegration";
import { CadastroDetailPanel } from "@/features/aprovacoes/components/CadastroDetailPanel";
import { getStatusContratoLabel } from "@/features/aprovacoes/constants";
import { PainelConfiguracaoTab } from "@/features/configuracoes/components/PainelConfiguracaoTab";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

// "Painel de Configuracao" (3a aba) e o antigo "Painel Administrativo",
// movido pra dentro do modulo RH - ver PainelConfiguracaoTab.tsx.
type AbaAprovacoes = "pendentes" | "aprovados" | "painel-configuracao";

export default function AprovacoesPage() {
  const router = useRouter();
  const pendentes = useAprovacoesStore((state) => state.pendentes);
  const aprovados = useAprovacoesStore((state) => state.aprovados);
  const isLoading = useAprovacoesStore((state) => state.isLoading);
  const isLoadingAprovados = useAprovacoesStore((state) => state.isLoadingAprovados);
  const selectCadastro = useAprovacoesStore((state) => state.selectCadastro);
  const { loadPendentes, loadAprovados } = useAprovacoesIntegration();
  const hasInitialized = useRef(false);
  const [aba, setAba] = useState<AbaAprovacoes>("pendentes");

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadPendentes();

    // Redirecionamento vindo da antiga URL /dashboard/configuracoes (ver
    // app/dashboard/configuracoes/page.tsx) - abre direto na aba certa.
    // Le de window.location em vez de useSearchParams() pra nao exigir
    // Suspense boundary nesta pagina (mesmo padrao ja usado em
    // app/dashboard/kanban/page.tsx).
    const params = new URLSearchParams(window.location.search);
    if (params.get("aba") === "painel-configuracao") {
      setAba("painel-configuracao");
      router.replace("/dashboard/rh/aprovacoes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabChange(tab: AbaAprovacoes) {
    setAba(tab);
    if (tab === "aprovados" && aprovados.length === 0) {
      loadAprovados();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Aprovacoes</h1>
        <div className="mt-3 flex rounded-lg border border-slate-200 p-0.5 w-fit">
          <button
            onClick={() => handleTabChange("pendentes")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              aba === "pendentes" ? "bg-blue-700 text-white" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => handleTabChange("aprovados")}
            data-testid="tab-aprovados"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              aba === "aprovados" ? "bg-blue-700 text-white" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Aprovados
          </button>
          <button
            onClick={() => handleTabChange("painel-configuracao")}
            data-testid="tab-painel-configuracao"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              aba === "painel-configuracao"
                ? "bg-blue-700 text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Painel de Configuração
          </button>
        </div>
      </header>

      <div className="p-6">
        {aba === "painel-configuracao" ? (
          <PainelConfiguracaoTab />
        ) : aba === "pendentes" ? (
          isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-sm">Carregando cadastros pendentes...</p>
            </div>
          ) : pendentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
              <UserCheck className="h-8 w-8" />
              <p className="text-sm">Nenhum cadastro pendente de aprovacao.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Perfil</th>
                    <th className="px-4 py-3 font-medium">Enviado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendentes.map((cadastro) => (
                    <tr
                      key={cadastro.id}
                      onClick={() => selectCadastro(cadastro.id)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{cadastro.name}</td>
                      <td className="px-4 py-3 text-slate-500">{cadastro.roleName}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {dateFormatter.format(new Date(cadastro.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : isLoadingAprovados ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm">Carregando corretores/parceiros aprovados...</p>
          </div>
        ) : aprovados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <FileSignature className="h-8 w-8" />
            <p className="text-sm">Nenhum corretor/parceiro aprovado ainda.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="aprovados-table">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Contrato de Prestação de Serviço</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aprovados.map((cadastro) => {
                  const status = getStatusContratoLabel(cadastro.statusContrato);
                  return (
                    <tr key={cadastro.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{cadastro.name}</td>
                      <td className="px-4 py-3 text-slate-500">{cadastro.roleName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.badgeClassName}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {cadastro.envelopeId && (
                          <Link
                            href={`/dashboard/edoc/${cadastro.envelopeId}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            Ver contrato <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CadastroDetailPanel />
    </div>
  );
}
